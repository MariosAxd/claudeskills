"""
File watcher: monitors source roots for changes and updates the Typesense index.

Runs natively in WSL. Windows paths from config (e.g. C:/myproject/src) are
automatically converted to WSL mount paths (/mnt/c/myproject/src).
Uses PollingObserver because inotify does not propagate from Windows-backed
/mnt/ filesystems in WSL.

Usage:
    python watcher.py
    python watcher.py --src /mnt/q/myrepo --collection my_collection
"""

import json
import os
import sys
import time
import threading
import argparse
from pathlib import Path

_base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _base not in sys.path:
    sys.path.insert(0, _base)

import typesense
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler

from codesearch.indexserver.config import (
    TYPESENSE_CLIENT_CONFIG, INCLUDE_EXTENSIONS,
    EXCLUDE_DIRS, MAX_FILE_BYTES, ROOTS, COLLECTION,
    collection_for_root,
)
from codesearch.indexserver.indexer import build_document, file_id

DEBOUNCE_SECONDS  = 2.0
POLL_INTERVAL_SEC = 10   # polling interval for PollingObserver on /mnt/ paths

# ── watcher stats (files indexed since last start) ────────────────────────────
_stats_lock = threading.Lock()
_stats: dict = {"files_upserted": 0, "files_deleted": 0, "last_flush": None, "started_at": None}
_STATS_FILE = Path.home() / ".local" / "typesense" / "watcher_stats.json"


def _write_stats() -> None:
    """Persist watcher stats to disk. Caller must hold _stats_lock."""
    try:
        _STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _STATS_FILE.write_text(json.dumps(_stats), encoding="utf-8")
    except Exception:
        pass


def _to_wsl_path(path: str) -> str:
    """Convert a Windows-style drive path to a WSL mount path.

    Examples:
        C:/myproject/src    ->  /mnt/c/myproject/src
        C:\\myproject\\src  ->  /mnt/c/myproject/src
        /mnt/q/...        ->  (unchanged)
    """
    p = path.replace("\\", "/")
    if len(p) >= 2 and p[1] == ":":
        return "/mnt/" + p[0].lower() + p[2:]
    return p


class CsChangeHandler(FileSystemEventHandler):
    def __init__(self, client, src_root: str, collection: str):
        super().__init__()
        self.client = client
        self.src_root = src_root
        self._collection = collection
        self._pending = {}
        self._lock = threading.Lock()
        self._timer = None

    def _schedule_flush(self):
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(DEBOUNCE_SECONDS, self._flush)
        self._timer.daemon = True
        self._timer.start()

    def _is_indexed(self, path):
        return os.path.splitext(path)[1].lower() in INCLUDE_EXTENSIONS

    def _is_excluded(self, path):
        parts = path.replace("\\", "/").split("/")
        return any(p in EXCLUDE_DIRS or p.startswith(".") for p in parts)

    def on_created(self, event):
        if not event.is_directory and self._is_indexed(event.src_path):
            if not self._is_excluded(event.src_path):
                with self._lock:
                    self._pending[event.src_path] = "upsert"
                self._schedule_flush()

    def on_modified(self, event):
        if not event.is_directory and self._is_indexed(event.src_path):
            if not self._is_excluded(event.src_path):
                with self._lock:
                    self._pending[event.src_path] = "upsert"
                self._schedule_flush()

    def on_deleted(self, event):
        if not event.is_directory and self._is_indexed(event.src_path):
            with self._lock:
                self._pending[event.src_path] = "delete"
            self._schedule_flush()

    def on_moved(self, event):
        if not event.is_directory:
            if self._is_indexed(event.src_path):
                with self._lock:
                    self._pending[event.src_path] = "delete"
            if self._is_indexed(event.dest_path) and not self._is_excluded(event.dest_path):
                with self._lock:
                    self._pending[event.dest_path] = "upsert"
            self._schedule_flush()

    def _flush(self):
        with self._lock:
            pending = dict(self._pending)
            self._pending.clear()

        upserts = []
        deletes = []

        for path, action in pending.items():
            rel = os.path.relpath(path, self.src_root).replace("\\", "/")
            if action == "upsert":
                if os.path.exists(path) and os.path.getsize(path) <= MAX_FILE_BYTES:
                    doc = build_document(path, rel)
                    if doc:
                        upserts.append(doc)
            elif action == "delete":
                deletes.append(file_id(rel))

        col = self.client.collections[self._collection]

        if upserts:
            try:
                col.documents.import_(upserts, {"action": "upsert"})
                print(f"[watcher] Indexed {len(upserts)} file(s)")
                for d in upserts:
                    print(f"          + {d['relative_path']}")
                with _stats_lock:
                    _stats["files_upserted"] += len(upserts)
                    _stats["last_flush"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                    _write_stats()
            except Exception as e:
                print(f"[watcher] ERROR upserting: {e}")

        if deletes:
            n_deleted = 0
            for doc_id in deletes:
                try:
                    col.documents[doc_id].delete()
                    print(f"[watcher] Removed {doc_id}")
                    n_deleted += 1
                except Exception:
                    pass
            if n_deleted:
                with _stats_lock:
                    _stats["files_deleted"] += n_deleted
                    _stats["last_flush"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                    _write_stats()


def run_watcher(src_root=None, collection=None):
    """Watch one or all configured roots for file changes.

    Resets the watcher stats counter on each start so the status output
    reflects activity since the most recent watcher start.

    If both src_root and collection are given, watches only that root.
    Otherwise watches every root in ROOTS config.
    Windows-style paths (Q:/...) are automatically converted to WSL paths.
    """
    with _stats_lock:
        _stats["files_upserted"] = 0
        _stats["files_deleted"] = 0
        _stats["last_flush"] = None
        _stats["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        _write_stats()

    if src_root is not None and collection is not None:
        wsl_path = _to_wsl_path(src_root)
        roots_map = {wsl_path: collection}
    else:
        roots_map = {
            _to_wsl_path(r): collection_for_root(name)
            for name, r in ROOTS.items()
        }

    client = typesense.Client(TYPESENSE_CLIENT_CONFIG)
    observers = []

    for src_native, coll_name in roots_map.items():
        handler = CsChangeHandler(client, src_native, collection=coll_name)
        obs = PollingObserver(timeout=POLL_INTERVAL_SEC)
        obs.schedule(handler, src_native, recursive=True)
        obs.start()
        observers.append(obs)
        print(f"[watcher] Watching {src_native} -> {coll_name}")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        for obs in observers:
            obs.stop()
    for obs in observers:
        obs.join()
    print("[watcher] Stopped.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Watch source files and update Typesense index")
    ap.add_argument("--src",        default=None, help="Single source root to watch")
    ap.add_argument("--collection", default=None, help="Collection for --src")
    args = ap.parse_args()
    run_watcher(src_root=args.src, collection=args.collection)

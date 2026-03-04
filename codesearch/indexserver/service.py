"""
Typesense service manager for code search.

Commands:
    status    - Show server health, document count, indexer/watcher state
    start     - Start server + watcher + heartbeat
    stop      - Stop server, watcher, and any running indexer
    restart   - stop then start
    index     - Run indexer in background (add --resethard to wipe data and reindex)
    log       - Tail the server, indexer, or heartbeat log
    watcher   - Start the file watcher standalone
    heartbeat - Start the heartbeat watchdog standalone

Usage:
    python service.py <command> [options]
    ts.cmd <command> [options]
"""

from __future__ import annotations

import os
import sys
import signal
import subprocess
import argparse
import time
import urllib.request
import json
from pathlib import Path

_base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _base not in sys.path:
    sys.path.insert(0, _base)

from codesearch.indexserver.config import (
    API_KEY, PORT, HOST, COLLECTION, ROOTS, collection_for_root,
)

# ── paths ──────────────────────────────────────────────────────────────────────
_HOME         = Path.home()
_RUN_DIR      = _HOME / ".local" / "typesense"
_RUN_DIR.mkdir(parents=True, exist_ok=True)

_THIS_DIR     = Path(__file__).parent                           # codesearch/indexserver/
_VENV_PY      = str(_HOME / ".local" / "indexserver-venv" / "bin" / "python3")
_SERVER_PY    = str(_THIS_DIR / "start_server.py")
_INDEXER_PY   = str(_THIS_DIR / "indexer.py")
_WATCHER_PY   = str(_THIS_DIR / "watcher.py")
_HEARTBEAT_PY = str(_THIS_DIR / "heartbeat.py")

_INDEXER_LOG   = str(_RUN_DIR / "indexer.log")
_HEARTBEAT_LOG = str(_RUN_DIR / "heartbeat.log")
_SERVER_PID    = str(_RUN_DIR / "typesense.pid")
_SERVER_LOG    = str(_RUN_DIR / "typesense.log")
_SERVER_ERR    = str(_RUN_DIR / "typesense-error.log")
_WATCHER_PID   = str(_RUN_DIR / "watcher.pid")
_INDEXER_PID   = str(_RUN_DIR / "indexer.pid")
_HEARTBEAT_PID = str(_RUN_DIR / "heartbeat.pid")
_WATCHER_STATS = str(_RUN_DIR / "watcher_stats.json")


# ── helpers ────────────────────────────────────────────────────────────────────

def _pid_alive(pid_file: str) -> tuple[bool, str]:
    if not os.path.exists(pid_file):
        return False, ""
    pid_str = open(pid_file).read().strip()
    if not pid_str:
        return False, ""
    try:
        os.kill(int(pid_str), 0)
        return True, pid_str
    except (OSError, ProcessLookupError, ValueError):
        return False, pid_str


def _typesense_health() -> dict:
    url = f"http://{HOST}:{PORT}/health"
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            body = json.loads(r.read())
            return {"ok": body.get("ok", False), "status": "healthy"}
    except Exception as e:
        return {"ok": False, "status": str(e)}


def _collection_stats(collection: str) -> dict | None:
    url = f"http://{HOST}:{PORT}/collections/{collection}"
    req = urllib.request.Request(url, headers={"X-TYPESENSE-API-KEY": API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            return json.loads(r.read())
    except Exception:
        return None


def _kill_pid(pid_file: str, label: str) -> None:
    alive, pid_str = _pid_alive(pid_file)
    if alive:
        try:
            os.kill(int(pid_str), signal.SIGTERM)
            print(f"  Stopped {label} (PID {pid_str})")
        except OSError:
            print(f"  {label}: kill failed (PID {pid_str})")
    else:
        print(f"  {label}: not running")
    if os.path.exists(pid_file):
        os.remove(pid_file)


# ── commands ───────────────────────────────────────────────────────────────────

def cmd_status(args) -> None:
    print("-- Typesense Service Status ------------------------------------------")

    server_alive, server_pid = _pid_alive(_SERVER_PID)
    health = _typesense_health()
    if health["ok"]:
        print(f"  Server  : [OK]  running  (pid={server_pid}, port={PORT})")
    elif server_alive:
        print(f"  Server  : [!!] process alive (pid={server_pid}) but health failed: {health['status']}")
    else:
        print(f"  Server  : [--] not running")

    for root_name, _src in ROOTS.items():
        coll_name = collection_for_root(root_name)
        stats = _collection_stats(coll_name)
        if stats:
            ndocs = stats.get("num_documents", 0)
            fields = [f["name"] for f in stats.get("fields", [])]
            idx_note = "" if "priority" in fields else \
                f"  [re-index needed: ts index --root {root_name} --resethard]"
            print(f"  [{root_name}] Index : {ndocs:,} docs  ({coll_name}){idx_note}")
        elif health["ok"]:
            print(f"  [{root_name}] Index : '{coll_name}' not found — run: ts index --root {root_name} --resethard")
        else:
            print(f"  [{root_name}] Index : (server unavailable)")

    watcher_alive, watcher_pid = _pid_alive(_WATCHER_PID)
    if watcher_alive:
        print(f"  Watcher : [OK]  running  (PID {watcher_pid}, watching {len(ROOTS)} root(s))")
    else:
        print(f"  Watcher : [--] not running")
    if os.path.exists(_WATCHER_STATS):
        try:
            with open(_WATCHER_STATS) as f:
                wstats = json.load(f)
            u       = wstats.get("files_upserted", 0)
            d       = wstats.get("files_deleted", 0)
            last    = wstats.get("last_flush") or "never"
            started = wstats.get("started_at") or "unknown"
            print(f"            since {started}: {u} upserted, {d} deleted  (last: {last})")
        except Exception:
            pass

    hb_alive, hb_pid = _pid_alive(_HEARTBEAT_PID)
    if hb_alive:
        last_hb = ""
        if os.path.exists(_HEARTBEAT_LOG):
            with open(_HEARTBEAT_LOG, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            last_hb = f"  last: {lines[-1].rstrip()}" if lines else ""
        print(f"  Heartbt : [OK]  running  (PID {hb_pid}){last_hb}")
    else:
        print(f"  Heartbt : [--] not running")

    indexer_alive, indexer_pid = _pid_alive(_INDEXER_PID)
    if indexer_alive:
        tail = ""
        if os.path.exists(_INDEXER_LOG):
            with open(_INDEXER_LOG, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            tail = lines[-1].rstrip() if lines else ""
        print(f"  Indexer : [>>] running  (PID {indexer_pid})")
        if tail:
            print(f"            {tail}")
    else:
        if os.path.exists(_INDEXER_LOG):
            with open(_INDEXER_LOG, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            last = lines[-1].rstrip() if lines else "(empty)"
            print(f"  Indexer : idle  (last: {last})")
        else:
            print(f"  Indexer : idle")

    print("----------------------------------------------------------------------")


def _to_native_path(path: str) -> str:
    """Convert a Windows-format path (X:/...) to the native path for this process."""
    import re as _re
    path = path.replace("\\", "/")
    if sys.platform == "linux":
        m = _re.match(r"^([a-zA-Z]):(.*)", path)
        if m:
            path = f"/mnt/{m.group(1).lower()}{m.group(2)}"
    return path


def cmd_start(args) -> None:
    if not API_KEY or not API_KEY.strip():
        print("ERROR: api_key is missing or blank in config.json.")
        print("       Delete config.json and re-run setup_mcp.cmd to regenerate it.")
        sys.exit(1)

    for root_name, raw_path in ROOTS.items():
        native = _to_native_path(raw_path)
        if not os.path.isdir(native):
            print(f"ERROR: Source directory for root '{root_name}' does not exist: {native}")
            print(f"       Check 'roots.{root_name}' in config.json, then run: ts restart")
            sys.exit(1)

    server_alive, _ = _pid_alive(_SERVER_PID)
    if not server_alive and not _typesense_health()["ok"]:
        print("Starting Typesense server...")
        result = subprocess.run([_VENV_PY, _SERVER_PY])
        if result.returncode != 0:
            print("ERROR: server failed to start")
            sys.exit(1)
    else:
        print("Server already running.")

    watcher_alive, _ = _pid_alive(_WATCHER_PID)
    if not watcher_alive:
        print(f"Starting file watcher ({len(ROOTS)} root(s))...")
        p = subprocess.Popen(
            [_VENV_PY, _WATCHER_PY],
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        open(_WATCHER_PID, "w").write(str(p.pid))
        print(f"  Watcher started (PID {p.pid})")
    else:
        print("Watcher already running.")

    hb_alive, _ = _pid_alive(_HEARTBEAT_PID)
    if not hb_alive:
        print("Starting heartbeat watchdog...")
        p = subprocess.Popen(
            [_VENV_PY, _HEARTBEAT_PY],
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        open(_HEARTBEAT_PID, "w").write(str(p.pid))
        print(f"  Heartbeat started (PID {p.pid})")
    else:
        print("Heartbeat already running.")

    # Auto-index any root whose collection is missing
    for root_name, _src in ROOTS.items():
        coll_name = collection_for_root(root_name)
        if _collection_stats(coll_name) is None:
            print(f"Collection '{coll_name}' not found — starting indexer...")
            indexer_alive, _ = _pid_alive(_INDEXER_PID)
            if not indexer_alive:
                import types as _types
                cmd_index(_types.SimpleNamespace(resethard=False, root=root_name))
                break
            else:
                print("  (indexer already running)")

    cmd_status(args)


def cmd_stop(args) -> None:
    print("Stopping services...")

    indexer_alive, indexer_pid = _pid_alive(_INDEXER_PID)
    if indexer_alive:
        try:
            os.kill(int(indexer_pid), signal.SIGTERM)
            print(f"  Stopped indexer (PID {indexer_pid})")
        except OSError:
            pass
    if os.path.exists(_INDEXER_PID):
        os.remove(_INDEXER_PID)

    _kill_pid(_HEARTBEAT_PID, "heartbeat")
    _kill_pid(_WATCHER_PID, "watcher")

    print("  Stopping Typesense server...")
    subprocess.run([_VENV_PY, _SERVER_PY, "--stop"])
    if os.path.exists(_SERVER_PID):
        os.remove(_SERVER_PID)


def cmd_restart(args) -> None:
    cmd_stop(args)
    time.sleep(2)
    cmd_start(args)


def cmd_index(args) -> None:
    import shutil

    indexer_alive, indexer_pid = _pid_alive(_INDEXER_PID)
    if indexer_alive:
        print(f"Indexer already running (PID {indexer_pid}). Stop it first with: ts stop")
        sys.exit(1)

    if args.resethard:
        data_dir = _RUN_DIR / "data"
        print("Hard reset: stopping server and wiping data directory...")
        subprocess.run([_VENV_PY, _SERVER_PY, "--stop"])
        for pid_file in (_SERVER_PID,):
            if os.path.exists(pid_file):
                os.remove(pid_file)
        time.sleep(1)
        if data_dir.exists():
            shutil.rmtree(str(data_dir))
            print(f"  Wiped {data_dir}")
        print("Restarting Typesense server...")
        result = subprocess.run([_VENV_PY, _SERVER_PY])
        if result.returncode != 0:
            print("ERROR: server failed to start after resethard")
            sys.exit(1)
    elif not _typesense_health()["ok"]:
        print("ERROR: Typesense server is not running. Start it first with: ts start")
        sys.exit(1)

    root_name = getattr(args, "root", None) or (
        "default" if "default" in ROOTS else next(iter(ROOTS))
    )
    if root_name not in ROOTS:
        print(f"ERROR: Unknown root '{root_name}'. Available: {sorted(ROOTS)}")
        sys.exit(1)

    coll_name = collection_for_root(root_name)
    src_path  = ROOTS[root_name]
    flags = ["--resethard"] if args.resethard else []

    print(f"Starting indexer for root '{root_name}' {'(--resethard) ' if args.resethard else ''}in background...")
    print(f"  Collection : {coll_name}")
    print(f"  Source     : {src_path}")
    print(f"  Log        : {_INDEXER_LOG}")

    with open(_INDEXER_LOG, "w", encoding="utf-8") as log:
        p = subprocess.Popen(
            [_VENV_PY, "-u", _INDEXER_PY,
             "--src", src_path,
             "--collection", coll_name] + flags,
            stdout=log,
            stderr=log,
            start_new_session=True,
        )
    open(_INDEXER_PID, "w").write(str(p.pid))
    print(f"  Indexer running (PID {p.pid})")
    print(f"  Monitor with: ts status   or   ts log --indexer")


def _tail_log(path: str, n: int, label: str) -> None:
    if not os.path.exists(path):
        print(f"No {label} log found.")
        return
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    for line in lines[-n:]:
        print(line, end="")


def cmd_log(args) -> None:
    n = args.lines or 40
    if args.heartbeat:
        _tail_log(_HEARTBEAT_LOG, n, "heartbeat")
    elif args.indexer:
        _tail_log(_INDEXER_LOG, n, "indexer")
    elif args.error:
        _tail_log(_SERVER_ERR, n, "server error")
    else:
        _tail_log(_SERVER_LOG, n, "server")


def cmd_heartbeat(args) -> None:
    hb_alive, pid = _pid_alive(_HEARTBEAT_PID)
    if hb_alive:
        print(f"Heartbeat already running (PID {pid})")
        return
    if not _typesense_health()["ok"]:
        print("ERROR: Typesense server is not running.")
        sys.exit(1)
    print("Starting heartbeat watchdog...")
    p = subprocess.Popen(
        [_VENV_PY, _HEARTBEAT_PY],
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    open(_HEARTBEAT_PID, "w").write(str(p.pid))
    print(f"Heartbeat started (PID {p.pid})  log: {_HEARTBEAT_LOG}")


def cmd_watcher(args) -> None:
    watcher_alive, pid = _pid_alive(_WATCHER_PID)
    if watcher_alive:
        print(f"Watcher already running (PID {pid})")
        return
    if not _typesense_health()["ok"]:
        print("ERROR: Typesense server is not running.")
        sys.exit(1)
    print(f"Starting file watcher (roots: {', '.join(ROOTS.keys())})...")
    p = subprocess.Popen(
        [_VENV_PY, _WATCHER_PY],
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    open(_WATCHER_PID, "w").write(str(p.pid))
    print(f"Watcher started (PID {p.pid})")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = ap.add_subparsers(dest="command", metavar="command")

    sub.add_parser("status",  help="Show service status")
    sub.add_parser("start",   help="Start server + watcher + heartbeat")
    sub.add_parser("stop",    help="Stop server + watcher + indexer")
    sub.add_parser("restart", help="Restart server + watcher")

    p_idx = sub.add_parser("index", help="Run indexer in background")
    p_idx.add_argument("--resethard", action="store_true",
                       help="Stop server, wipe data directory, restart, and reindex from scratch")
    p_idx.add_argument("--root", default=None,
                       help="Named root to index (default: first configured root)")

    p_log = sub.add_parser("log", help="Show server, indexer, or heartbeat log")
    p_log.add_argument("--indexer",   action="store_true", help="Show indexer log")
    p_log.add_argument("--heartbeat", action="store_true", help="Show heartbeat log")
    p_log.add_argument("--error",     action="store_true", help="Show server error log (stderr)")
    p_log.add_argument("--lines", "-n", type=int, default=40, help="Lines to show (default 40)")

    sub.add_parser("watcher",   help="Start the file watcher standalone")
    sub.add_parser("heartbeat", help="Start the heartbeat watchdog standalone")

    args = ap.parse_args()
    if not args.command:
        ap.print_help()
        sys.exit(0)

    dispatch = {
        "status":    cmd_status,
        "start":     cmd_start,
        "stop":      cmd_stop,
        "restart":   cmd_restart,
        "index":     cmd_index,
        "log":       cmd_log,
        "watcher":   cmd_watcher,
        "heartbeat": cmd_heartbeat,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()

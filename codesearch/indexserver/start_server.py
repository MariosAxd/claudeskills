"""
Manage the Typesense server running in WSL.

The Typesense binary lives at ~/.local/typesense/typesense-server.
This script runs natively in WSL and uses bash directly.

Usage:
    python start_server.py         -- start the server
    python start_server.py --stop  -- stop the server
    python start_server.py --log   -- print the server log
"""

import os
import sys
import time
import subprocess
import argparse
import urllib.request
from pathlib import Path

_base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _base not in sys.path:
    sys.path.insert(0, _base)

from codesearch.indexserver.config import API_KEY, PORT

_HOME    = Path.home()
_RUN_DIR = _HOME / ".local" / "typesense"
_RUN_DIR.mkdir(parents=True, exist_ok=True)

PID_FILE = _RUN_DIR / "typesense.pid"

BIN_PATH  = "~/.local/typesense/typesense-server"
DATA_PATH = "~/.local/typesense/data"
LOG_PATH  = "~/.local/typesense/typesense.log"


# ── shell helpers ──────────────────────────────────────────────────────────────

def _sh(cmd: str, check=False, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(["bash", "-c", cmd], check=check, **kwargs)


def _sh_out(cmd: str) -> str:
    r = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
    return r.stdout.strip()


# ── Core operations ────────────────────────────────────────────────────────────

def wait_for_ready(timeout: int = 40) -> bool:
    url = f"http://localhost:{PORT}/health"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        print(".", end="", flush=True)
        time.sleep(1)
    print()
    return False


def is_running() -> bool:
    if not PID_FILE.exists():
        return False
    pid = PID_FILE.read_text().strip()
    if not pid:
        return False
    result = _sh_out(f"kill -0 {pid} 2>/dev/null && echo yes || echo no")
    return result == "yes"


def start():
    if is_running():
        print(f"Typesense is already running on port {PORT}.")
        return

    exists = _sh_out(f"test -x {BIN_PATH} && echo ok || echo missing")
    if exists != "ok":
        print(f"ERROR: Typesense binary not found at {BIN_PATH}.")
        print(f"       Run setup_mcp.cmd to install all dependencies.")
        sys.exit(1)

    launch = (
        f"mkdir -p {DATA_PATH} && "
        f"setsid {BIN_PATH} "
        f"--data-dir={DATA_PATH} "
        f"--api-key={API_KEY} "
        f"--port={PORT} "
        f"--enable-cors "
        f">{LOG_PATH} 2>&1 & "
        f"sleep 0.5; pgrep -f 'typesense-server' | head -1"
    )
    pid = _sh_out(launch)
    if not pid.isdigit():
        print(f"ERROR: Could not get PID. Output: '{pid}'")
        print(f"Check log: cat {LOG_PATH}")
        sys.exit(1)

    PID_FILE.write_text(pid)
    print(f"Typesense started (pid={pid}). Waiting for health check", end="")

    if wait_for_ready():
        print(f"Ready at http://localhost:{PORT}")
    else:
        print(f"\nWARNING: did not respond in 40s. Check log:")
        print(f"  cat {LOG_PATH}")


def stop():
    if not PID_FILE.exists():
        _sh("pkill -f typesense-server 2>/dev/null || true")
        print("Sent kill signal (no PID file found).")
        return
    pid = PID_FILE.read_text().strip()
    _sh(f"kill {pid} 2>/dev/null || true")
    PID_FILE.unlink(missing_ok=True)
    print(f"Typesense (pid={pid}) stopped.")


def show_log():
    _sh(f"cat {LOG_PATH}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stop", action="store_true", help="Stop the server")
    ap.add_argument("--log",  action="store_true", help="Print the server log")
    args = ap.parse_args()
    if args.log:
        show_log()
    elif args.stop:
        stop()
    else:
        start()

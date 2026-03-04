"""
Manage the Typesense server running in WSL.

The Typesense binary lives at ~/.local/typesense/typesense-server.
This script runs natively in WSL.

Usage:
    python start_server.py           -- start the server
    python start_server.py --stop    -- stop the server
    python start_server.py --log     -- print the info log
    python start_server.py --errlog  -- print the error log
"""

import os
import sys
import time
import signal
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

PID_FILE      = _RUN_DIR / "typesense.pid"
BIN_PATH      = str(_RUN_DIR / "typesense-server")
DATA_PATH     = str(_RUN_DIR / "data")
LOG_PATH      = str(_RUN_DIR / "typesense.log")
ERROR_LOG_PATH = str(_RUN_DIR / "typesense-error.log")


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
    if not pid.isdigit():
        return False
    try:
        os.kill(int(pid), 0)  # signal 0 = existence check
        return True
    except (OSError, ProcessLookupError):
        return False


def start():
    if is_running():
        print(f"Typesense is already running on port {PORT}.")
        return

    if not os.path.isfile(BIN_PATH) or not os.access(BIN_PATH, os.X_OK):
        print(f"ERROR: Typesense binary not found at {BIN_PATH}.")
        print(f"       Run setup_mcp.cmd to install all dependencies.")
        sys.exit(1)

    os.makedirs(DATA_PATH, exist_ok=True)

    # Launch Typesense directly via Popen — NOT via a shell with capture_output.
    # Using a shell + capture_output would block forever because bash waits for
    # its child (Typesense) before exiting, keeping the stdout pipe open.
    with open(LOG_PATH, "w") as log_out, open(ERROR_LOG_PATH, "w") as log_err:
        p = subprocess.Popen(
            [BIN_PATH,
             f"--data-dir={DATA_PATH}",
             f"--api-key={API_KEY}",
             f"--api-port={PORT}",
             "--enable-cors"],
            stdout=log_out,
            stderr=log_err,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    PID_FILE.write_text(str(p.pid))
    print(f"Typesense started (pid={p.pid}). Waiting for health check", end="")

    if wait_for_ready():
        print(f" Ready at http://localhost:{PORT}")
    else:
        print(f"\nERROR: Typesense did not respond within 40s. Check logs:")
        print(f"  cat {LOG_PATH}")
        print(f"  cat {ERROR_LOG_PATH}")
        sys.exit(1)


def stop():
    if not PID_FILE.exists():
        subprocess.run(["pkill", "-f", "typesense-server"], capture_output=True)
        print("Sent kill signal (no PID file found).")
        return
    pid = PID_FILE.read_text().strip()
    if pid.isdigit():
        try:
            os.kill(int(pid), signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass
    PID_FILE.unlink(missing_ok=True)
    print(f"Typesense (pid={pid}) stopped.")


def show_log():
    subprocess.run(["cat", LOG_PATH])


def show_error_log():
    subprocess.run(["cat", ERROR_LOG_PATH])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stop",    action="store_true", help="Stop the server")
    ap.add_argument("--log",     action="store_true", help="Print the info log")
    ap.add_argument("--errlog",  action="store_true", help="Print the error log")
    args = ap.parse_args()
    if args.log:
        show_log()
    elif args.errlog:
        show_error_log()
    elif args.stop:
        stop()
    else:
        start()

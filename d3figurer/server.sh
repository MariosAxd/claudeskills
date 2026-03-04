#!/usr/bin/env bash
# server.sh — d3figurer render server lifecycle manager
#
# Architecture: Chrome runs as a persistent background process with
# --remote-debugging-port.  render-server.js connects to it via
# puppeteer.connect() instead of launching its own Chrome, which means:
#   • server.sh start    : Chrome starts once; render-server.js connects
#   • server.sh restart  : only render-server.js restarts — Chrome stays warm
#   • server.sh stop     : stops both render-server.js and Chrome
#
# When installed via npm (npm install -g d3figurer), node_modules and Chrome
# are already in place and no separate install step is needed.
#
# For development with source on a Windows/NTFS mount (WSL2), use the
# working-directory approach to keep node_modules on the Linux FS:
#   <work-dir>/d3figurer/    node_modules (Linux FS for performance)
#   <work-dir>/puppeteer/    Chrome binary (PUPPETEER_CACHE_DIR)
#   <work-dir>/run/          PID files and logs
#
# Default work-dir: ~/.d3figurer-work  (override with --work-dir or D3FIGURER_WORK_DIR)
# Run 'install' once to set up the work-dir.
#
# Commands:
#   ./server.sh install [--work-dir <path>]              one-time: install node_modules
#   ./server.sh start [--work-dir <path>] [--src-dir p]  start Chrome + render server
#   ./server.sh stop  [--work-dir <path>]                graceful stop (both processes)
#   ./server.sh restart [--work-dir <path>]              restart render-server only
#   ./server.sh status  [--work-dir <path>]              check running / ready
#   ./server.sh log     [--work-dir <path>]              tail render-server log
#   ./server.sh chrome-log [--work-dir <path>]           tail Chrome log

set -euo pipefail

FIGURER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=9229
CHROME_PORT=9230

# ── Helpers ─────────────────────────────────────────────────────────────────
is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

server_ready() {
  curl -s "http://localhost:$PORT/" 2>/dev/null | grep -q '"ready":true'
}

chrome_is_running() {
  [ -f "$CHROME_PID_FILE" ] && kill -0 "$(cat "$CHROME_PID_FILE")" 2>/dev/null
}

chrome_ready() {
  curl -s "http://127.0.0.1:$CHROME_PORT/json/version" 2>/dev/null | grep -q '"Browser"'
}

find_chrome() {
  # 1. Search WORK_DIR (dev mode / server.sh install)
  local c
  c=$(find "$PUPPETEER_DIR" -name "chrome" -type f 2>/dev/null | head -1)
  if [ -n "$c" ]; then echo "$c"; return; fi

  # 2. Ask Puppeteer — works when installed via npm (Chrome in ~/.cache/puppeteer/)
  local mods=""
  if [ -d "$FIGURER_DIR/node_modules" ]; then
    mods="$FIGURER_DIR/node_modules"
  elif [ -d "$MODULES_DIR/node_modules" ]; then
    mods="$MODULES_DIR/node_modules"
  fi
  if [ -n "$mods" ]; then
    local path
    path=$(NODE_PATH="$mods" node --no-warnings -e \
      "try{const p=require('puppeteer');const e=p.executablePath();if(e)process.stdout.write(e)}catch(e){}" \
      2>/dev/null || true)
    if [ -n "$path" ] && [ -f "$path" ]; then echo "$path"; return; fi
    # Fallback: search Puppeteer's default cache directory
    find "$HOME/.cache/puppeteer" -name "chrome" -type f 2>/dev/null | head -1 || true
  fi
}

# ── Commands ─────────────────────────────────────────────────────────────────
cmd="${1:-help}"
shift || true   # remaining $@ = extra args

# Parse options — work-dir must be resolved before deriving paths
WORK_DIR="${D3FIGURER_WORK_DIR:-$HOME/.d3figurer-work}"
SRC_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --work-dir) WORK_DIR="$2"; shift 2 ;;
    --src-dir)  SRC_DIR="$2";  shift 2 ;;
    --port)     PORT="$2";     shift 2 ;;
    *) shift ;;
  esac
done

# Derive all paths from WORK_DIR (caller decides where things live)
MODULES_DIR="$WORK_DIR/d3figurer"
PUPPETEER_DIR="$WORK_DIR/puppeteer"
RUN_DIR="$WORK_DIR/run"
PID_FILE="$RUN_DIR/d3figurer.pid"
LOG_FILE="$RUN_DIR/d3figurer.log"
CHROME_PID_FILE="$RUN_DIR/chrome.pid"
CHROME_LOG="$RUN_DIR/chrome.log"

case "$cmd" in

  install)
    if [ -d "$FIGURER_DIR/node_modules" ]; then
      echo "Skipping install: d3figurer is installed as an npm package."
      echo "(node_modules found at $FIGURER_DIR/node_modules)"
      exit 0
    fi
    echo "Installing d3figurer node_modules to $MODULES_DIR (Linux FS)"
    echo ""
    mkdir -p "$MODULES_DIR" "$PUPPETEER_DIR" "$RUN_DIR"
    cp "$FIGURER_DIR/package.json" "$MODULES_DIR/"
    if [ -f "$FIGURER_DIR/package-lock.json" ]; then
      cp "$FIGURER_DIR/package-lock.json" "$MODULES_DIR/"
    fi
    cd "$MODULES_DIR"
    # Tell puppeteer to download Chrome into $PUPPETEER_DIR
    if [ -f "package-lock.json" ]; then
      PUPPETEER_CACHE_DIR="$PUPPETEER_DIR" npm ci
    else
      PUPPETEER_CACHE_DIR="$PUPPETEER_DIR" npm install
    fi
    # Remove any node_modules on the mounted volume if they exist
    if [ -e "$FIGURER_DIR/node_modules" ] || [ -L "$FIGURER_DIR/node_modules" ]; then
      echo "Removing node_modules from /mnt/c/ ..."
      rm -rf "$FIGURER_DIR/node_modules"
    fi
    echo ""
    echo "Done. node_modules → $MODULES_DIR"
    echo "      Chrome       → $PUPPETEER_DIR"
    echo "      Logs         → $RUN_DIR"
    echo "Start the server:  ./server.sh start --src-dir /path/to/figures"
    ;;

  start)
    if is_running; then
      echo "Already running (PID $(cat "$PID_FILE"))"
      exit 0
    fi

    # Determine node_modules location: npm install (next to source) or dev/WORK_DIR mode
    if [ -d "$FIGURER_DIR/node_modules" ]; then
      FIGURER_MODULES="$FIGURER_DIR/node_modules"
      NEED_NODE_PATH=false
    elif [ -d "$MODULES_DIR/node_modules" ]; then
      FIGURER_MODULES="$MODULES_DIR/node_modules"
      NEED_NODE_PATH=true
    else
      echo "node_modules not found. Run './server.sh install' first (or 'npm install -g d3figurer')."
      exit 1
    fi

    mkdir -p "$RUN_DIR"

    # ── Step 1: ensure Chrome is running ──────────────────────────────────
    if ! chrome_is_running; then
      CHROME_EXE="$(find_chrome)"
      if [ -z "$CHROME_EXE" ]; then
        echo "Chrome not found in $PUPPETEER_DIR. Run './server.sh install' first."
        exit 1
      fi
      echo "Starting Chrome (remote-debug on :$CHROME_PORT)..."
      "$CHROME_EXE" \
        --headless=new --no-sandbox --disable-setuid-sandbox \
        --disable-dev-shm-usage \
        --remote-debugging-port="$CHROME_PORT" \
        --remote-debugging-address=127.0.0.1 \
        --no-first-run --no-default-browser-check \
        > "$CHROME_LOG" 2>&1 &
      echo $! > "$CHROME_PID_FILE"
      # Wait up to 10s for Chrome DevTools endpoint
      for i in $(seq 1 20); do
        sleep 0.5
        if chrome_ready; then break; fi
      done
      if ! chrome_ready; then
        echo "Chrome failed to start. Check: $CHROME_LOG"
        rm -f "$CHROME_PID_FILE"
        exit 1
      fi
      echo "Chrome ready."
    else
      echo "Chrome already running (PID $(cat "$CHROME_PID_FILE"))."
    fi

    # ── Step 2: start render server ──────────────────────────────────────
    echo "Starting d3figurer render server..."
    RESOLVED_SRC_DIR=""
    if [ -n "$SRC_DIR" ]; then
      RESOLVED_SRC_DIR="$(realpath "$SRC_DIR")"
    fi

    if $NEED_NODE_PATH; then
      NODE_PATH="$FIGURER_MODULES" \
      CHROME_URL="http://127.0.0.1:$CHROME_PORT" \
      PUPPETEER_CACHE_DIR="$PUPPETEER_DIR" \
      D3FIGURER_SRC_DIR="$RESOLVED_SRC_DIR" \
        node "$FIGURER_DIR/bin/d3figurer-server.js" "$PORT" > "$LOG_FILE" 2>&1 &
    else
      CHROME_URL="http://127.0.0.1:$CHROME_PORT" \
      D3FIGURER_SRC_DIR="$RESOLVED_SRC_DIR" \
        node "$FIGURER_DIR/bin/d3figurer-server.js" "$PORT" > "$LOG_FILE" 2>&1 &
    fi
    echo $! > "$PID_FILE"
    echo "PID $(cat "$PID_FILE") — waiting for ready..."
    for i in $(seq 1 30); do
      sleep 1
      if server_ready; then
        echo "Ready in ${i}s"
        exit 0
      fi
      if ! is_running; then
        echo "Server crashed. Last log lines:"
        tail -20 "$LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
      fi
    done
    echo "Server taking longer than expected — check: $LOG_FILE"
    ;;

  stop)
    if is_running; then
      pid=$(cat "$PID_FILE")
      curl -s -X DELETE "http://localhost:$PORT/" >/dev/null 2>&1 || true
      sleep 1
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    if chrome_is_running; then
      kill "$(cat "$CHROME_PID_FILE")" 2>/dev/null || true
    fi
    rm -f "$CHROME_PID_FILE"
    echo "Stopped"
    ;;

  restart)
    # Restart render-server only — Chrome stays running for speed
    if is_running; then
      pid=$(cat "$PID_FILE")
      curl -s -X DELETE "http://localhost:$PORT/" >/dev/null 2>&1 || true
      sleep 1
      kill "$pid" 2>/dev/null || true
      rm -f "$PID_FILE"
    fi
    sleep 1
    # Re-invoke start; pass --work-dir and --src-dir so paths resolve correctly
    EXTRA="--work-dir $WORK_DIR"
    if [ -n "$SRC_DIR" ]; then EXTRA="$EXTRA --src-dir $SRC_DIR"; fi
    exec "$0" start $EXTRA
    ;;

  status)
    if chrome_is_running; then
      chrome_status="Chrome on :$CHROME_PORT (PID $(cat "$CHROME_PID_FILE"))"
    else
      chrome_status="Chrome not running"
    fi
    if [ -d "$FIGURER_DIR/node_modules" ]; then
      modules_status="modules: $FIGURER_DIR (npm)"
    elif [ -d "$MODULES_DIR/node_modules" ]; then
      modules_status="modules: $MODULES_DIR"
    else
      modules_status="modules: NOT INSTALLED (run './server.sh install')"
    fi
    if is_running; then
      pid=$(cat "$PID_FILE")
      if server_ready; then
        echo "Running — PID $pid, ready on :$PORT | $modules_status | $chrome_status"
      else
        echo "Running — PID $pid, still starting... | $modules_status | $chrome_status"
      fi
    else
      echo "Not running | $modules_status | $chrome_status"
    fi
    ;;

  log)
    if [ -f "$LOG_FILE" ]; then
      tail -f "$LOG_FILE"
    else
      echo "No log file yet: $LOG_FILE"
    fi
    ;;

  chrome-log)
    if [ -f "$CHROME_LOG" ]; then
      tail -f "$CHROME_LOG"
    else
      echo "No Chrome log file yet: $CHROME_LOG"
    fi
    ;;

  help|--help|-h)
    echo "Usage: ./server.sh {install|start|stop|restart|status|log|chrome-log} [options]"
    echo ""
    echo "  install                      one-time: install node_modules + Chrome to <work-dir>"
    echo "  start [--src-dir path]       start Chrome + render server"
    echo "  stop                         graceful stop (both render-server and Chrome)"
    echo "  restart [--src-dir path]     restart render-server only (Chrome stays warm)"
    echo "  status                       check if running and ready"
    echo "  log                          tail render-server log"
    echo "  chrome-log                   tail Chrome log"
    echo ""
    echo "Options:"
    echo "  --work-dir <path>  where to install modules, Chrome, and write PID/logs"
    echo "                     (default: ~/.d3figurer-work, or \$D3FIGURER_WORK_DIR)"
    echo "  --src-dir <path>   directory containing figure modules (src/<name>/figure.js)"
    echo "  --port <n>         HTTP port (default: 9229)"
    ;;

  *)
    echo "Unknown command: $cmd"
    echo "Run './server.sh help' for usage"
    exit 1
    ;;
esac

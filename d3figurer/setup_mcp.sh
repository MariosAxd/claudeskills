#!/usr/bin/env bash
# setup_mcp.sh — install d3figurer and register it as a Claude Code MCP server.
#
# Works on: WSL2, native Linux, macOS.
# Windows CMD users: run setup_mcp.cmd instead (delegates here via wsl bash).
#
# What this does:
#   [1/3] Ensures Node.js >= 18 is installed
#   [2/3] Installs node_modules + Chrome (skipped when installed as npm package)
#   [3/3] Registers mcp.sh with Claude Code (claude mcp add --scope user)
#
# Override the work directory: D3FIGURER_WORK_DIR=/path ./setup_mcp.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse arguments ───────────────────────────────────────────────────────────
PREFER_WINDOWS=false
for arg in "$@"; do
  [[ "$arg" == "--prefer-windows" ]] && PREFER_WINDOWS=true
done

# ── Detect platform ───────────────────────────────────────────────────────────
IS_WSL=false
IS_MAC=false
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
[[ "$(uname -s)" == "Darwin" ]] && IS_MAC=true

# ── Detect claude command ─────────────────────────────────────────────────────
# When invoked from setup_mcp.cmd (--prefer-windows), prefer claude.exe.
# When invoked directly in WSL/Linux/macOS, prefer the native claude.
find_claude() {
  if $PREFER_WINDOWS; then
    command -v claude.exe 2>/dev/null && return
    command -v claude     2>/dev/null && return
  else
    command -v claude     2>/dev/null && return
    command -v claude.exe 2>/dev/null && return
  fi
  echo "Error: 'claude' not found. Install Claude Code first." >&2
  exit 1
}
CLAUDE="$(find_claude)"

# ── [1/3] Ensure Node.js >= 18 ───────────────────────────────────────────────
echo
echo "[1/3] Checking Node.js..."
need_node=false
if ! command -v node &>/dev/null; then
  need_node=true
  echo "  node not found — installing..."
else
  node_ver=$(node -e 'process.stdout.write(process.versions.node)' 2>/dev/null || echo "0")
  node_major=$(echo "$node_ver" | cut -d. -f1)
  if [ "$node_major" -lt 18 ]; then
    need_node=true
    echo "  node $node_ver found but >= 18 required — upgrading..."
  else
    echo "  node $node_ver OK"
  fi
fi

if $need_node; then
  if $IS_MAC; then
    if command -v brew &>/dev/null; then
      brew install node
    else
      echo "  Homebrew not found. Install Node.js >= 18 from https://nodejs.org/en/download/" >&2
      echo "  Or install Homebrew first: https://brew.sh" >&2
      exit 1
    fi
  elif command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq nodejs npm
    # Upgrade to a recent LTS via NodeSource if still < 18
    node_major=$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))' 2>/dev/null || echo "0")
    if [ "$node_major" -lt 18 ]; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    fi
  else
    echo "  Please install Node.js >= 18 from https://nodejs.org/en/download/" >&2
    exit 1
  fi
fi

# ── [2/3] Install node_modules + Chrome ──────────────────────────────────────
echo
echo "[2/3] Installing d3figurer dependencies..."
if [ -d "$DIR/node_modules" ]; then
  echo "  Skipping — already installed as an npm package."
else
  "$DIR/server.sh" install
fi

# ── [3/3] Register MCP with Claude Code ──────────────────────────────────────
echo
echo "[3/3] Registering MCP server with Claude Code..."
"$CLAUDE" mcp remove --scope user d3figurer 2>/dev/null || true
"$CLAUDE" mcp add --scope user d3figurer -- bash "$DIR/mcp.sh"

echo
echo "Done. Restart Claude Code for the change to take effect."
echo
echo "To start the render server:"
echo "  $DIR/server.sh start --src-dir <path/to/figures>"

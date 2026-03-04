#!/usr/bin/env bash
# Self-locating d3figurer MCP server launcher — no hardcoded paths.
# Registered via setup_mcp.sh; works with both npm install and dev/WSL mode.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$DIR/node_modules" ]; then
  # npm install — modules are next to the package, no NODE_PATH needed
  exec node "$DIR/mcp_server.js"
else
  # dev/WSL mode — modules are in WORK_DIR on the Linux FS
  WORK_DIR="${D3FIGURER_WORK_DIR:-$HOME/.d3figurer-work}"
  exec NODE_PATH="$WORK_DIR/d3figurer/node_modules" node "$DIR/mcp_server.js"
fi

#!/usr/bin/env bash
# Sets up all WSL-side dependencies for codesearch.
# Called automatically by setup_mcp.cmd; can also be run directly in WSL.
#
# Installs / updates:
#   ~/.local/mcp-venv/                   -- MCP client (mcp_server.py / mcp.sh)
#   ~/.local/indexserver-venv/           -- Indexserver (ts.sh / service.py / indexer.py)
#   ~/.local/typesense/typesense-server  -- Typesense search engine binary
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_VENV="$HOME/.local/mcp-venv"
IDX_VENV="$HOME/.local/indexserver-venv"

# ── Read Typesense version from config.py (single source of truth) ────────────
TYPESENSE_VERSION=$(sed -n 's/^TYPESENSE_VERSION = "\(.*\)"/\1/p' \
    "$SCRIPT_DIR/indexserver/config.py")
if [ -z "$TYPESENSE_VERSION" ]; then
    echo "ERROR: Could not read TYPESENSE_VERSION from indexserver/config.py."
    echo "       Expected line: TYPESENSE_VERSION = \"<version>\""
    echo "       File: $SCRIPT_DIR/indexserver/config.py"
    exit 1
fi

# ── Verify prerequisites ───────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found in WSL."
    echo "       Fix: sudo apt-get install -y python3 python3-venv python3-pip"
    exit 1
fi
if ! python3 -m venv --help &>/dev/null 2>&1; then
    echo "ERROR: python3-venv module not available."
    echo "       Fix: sudo apt-get install -y python3-venv"
    exit 1
fi
if ! command -v curl &>/dev/null; then
    echo "ERROR: curl not found in WSL."
    echo "       Fix: sudo apt-get install -y curl"
    exit 1
fi

PY=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "  Python $PY  |  Typesense $TYPESENSE_VERSION"

# ── [WSL 1/3] MCP client venv ─────────────────────────────────────────────────
echo ""
echo "[WSL 1/3] MCP venv: $MCP_VENV"
python3 -m venv "$MCP_VENV"
"$MCP_VENV/bin/pip" install --quiet --upgrade pip
if ! "$MCP_VENV/bin/pip" install --quiet --upgrade \
        mcp tree-sitter tree-sitter-c-sharp; then
    echo "ERROR: pip install failed for MCP venv."
    echo "       Check network connectivity or proxy settings and re-run setup_mcp.cmd."
    exit 1
fi
echo "  Done."

# ── [WSL 2/3] Indexserver venv ────────────────────────────────────────────────
echo ""
echo "[WSL 2/3] Indexserver venv: $IDX_VENV"
python3 -m venv "$IDX_VENV"
"$IDX_VENV/bin/pip" install --quiet --upgrade pip
if ! "$IDX_VENV/bin/pip" install --quiet --upgrade \
        typesense tree-sitter tree-sitter-c-sharp watchdog pytest; then
    echo "ERROR: pip install failed for indexserver venv."
    echo "       Check network connectivity or proxy settings and re-run setup_mcp.cmd."
    exit 1
fi
echo "  Done."

# ── [WSL 3/3] Typesense binary ────────────────────────────────────────────────
TYPESENSE_BIN="$HOME/.local/typesense/typesense-server"
TAR_URL="https://dl.typesense.org/releases/${TYPESENSE_VERSION}/typesense-server-${TYPESENSE_VERSION}-linux-amd64.tar.gz"

echo ""
echo "[WSL 3/3] Typesense v${TYPESENSE_VERSION}: $TYPESENSE_BIN"
if [ -x "$TYPESENSE_BIN" ]; then
    echo "  Already installed, skipping download."
else
    echo "  Downloading from dl.typesense.org ..."
    mkdir -p "$HOME/.local/typesense"
    if ! curl -fL --progress-bar "$TAR_URL" | tar -xz -C "$HOME/.local/typesense/"; then
        echo "ERROR: Failed to download or extract Typesense v${TYPESENSE_VERSION}."
        echo "       URL: $TAR_URL"
        echo "       Check network connectivity and re-run setup_mcp.cmd."
        exit 1
    fi
    ACTUAL=$(find "$HOME/.local/typesense" -name 'typesense-server' -type f \
             2>/dev/null | head -1)
    if [ -z "$ACTUAL" ]; then
        echo "ERROR: typesense-server binary not found after extraction."
        echo "       The archive may have an unexpected layout."
        echo "       URL attempted: $TAR_URL"
        exit 1
    fi
    if [ "$ACTUAL" != "$TYPESENSE_BIN" ]; then
        mv "$ACTUAL" "$TYPESENSE_BIN"
    fi
    chmod +x "$TYPESENSE_BIN"
    echo "  Installed at $TYPESENSE_BIN"
fi
echo "  Done."

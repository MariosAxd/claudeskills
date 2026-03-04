#!/usr/bin/env bash
# Run d3figurer unit tests.
#
# Usage:
#   ./test.sh                        # quiet summary
#   ./test.sh -v                     # verbose (all ✔/✖ lines)
#   ./test.sh "makeQueue"            # run tests whose name matches pattern
#   ./test.sh -v "normalizePdf"      # verbose + pattern
#
# The pattern is passed to node --test-name-pattern (regex).

VERBOSE=0
PATTERN=""

for arg in "$@"; do
  case "$arg" in
    -v|--verbose) VERBOSE=1 ;;
    *)            PATTERN="$arg" ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Find node_modules: next to the package (npm install) or in WORK_DIR (dev/WSL)
if [ -d "$SCRIPT_DIR/node_modules" ]; then
  NODE_MODULES="$SCRIPT_DIR/node_modules"
else
  NODE_MODULES="${D3FIGURER_WORK_DIR:-$HOME/.d3figurer-work}/d3figurer/node_modules"
fi

cd "$SCRIPT_DIR"

PATTERN_ARG=()
[[ -n "$PATTERN" ]] && PATTERN_ARG=(--test-name-pattern "$PATTERN")

# Run tests, strip the renderBatch stub noise unconditionally
raw=$(
  NODE_PATH="$NODE_MODULES" node --test --test-reporter=spec \
    "${PATTERN_ARG[@]}" \
    tests/test-checker.js \
    tests/test-client.js \
    tests/test-server-internals.js \
    tests/test-mcp-server.js \
    2>&1 \
  | grep -v -E "^[.E]+$|^Done — |^  ERROR [a-z]: "
)

if [[ "$VERBOSE" -eq 1 ]]; then
  echo "$raw"
else
  # Quiet: show failures (✖ lines + their indented detail) and ℹ summary
  echo "$raw" | awk '
    /^✖/ { fail=1; print; next }
    fail && /^  / { print; next }
    fail { fail=0 }
    /^ℹ / { print }
  '
fi

# Exit 1 if any test failed
echo "$raw" | grep -qE "^✖|ℹ fail [^0]" && exit 1 || exit 0

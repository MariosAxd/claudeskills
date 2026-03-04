#!/usr/bin/env bash
# Run the indexserver test suite.
# Usage: run-server-tests.sh [pytest-filter]
#   run-server-tests.sh                  -- all tests
#   run-server-tests.sh TestSearchFieldModes  -- specific class
#   run-server-tests.sh test_method_sigs      -- specific method
REPO="$(cd "$(dirname "$0")" && pwd)"
FILTER="${1:-}"
if [[ -n "$FILTER" ]]; then
    exec ~/.local/indexserver-venv/bin/pytest "$REPO/tests/test_indexserver.py" -v -k "$FILTER"
else
    exec ~/.local/indexserver-venv/bin/pytest "$REPO/tests/test_indexserver.py" -v
fi

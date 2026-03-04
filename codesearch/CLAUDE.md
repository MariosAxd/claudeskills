# codesearch — developer notes for Claude

## Architecture overview

Two distinct layers that run in separate processes and venvs:

```
┌─────────────────────────────────────────────────────────────┐
│  MCP CLIENT  (Claude ↔ tools)                               │
│  mcp_server.py   search.py   query.py   config.py           │
│  Claude Code VSCode ext → mcp.sh  (WSL)  ← actual in use   │
│  Manual/CI alternative  → mcp.cmd (Windows)                 │
│  Venv (WSL):     ~/.local/mcp-venv/bin/python               │
│  Venv (Windows): codesearch/.venv/Scripts/python.exe        │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP  localhost:8108
┌────────────────────────▼────────────────────────────────────┐
│  INDEXSERVER  (Typesense + indexing)                        │
│  indexserver/service.py   indexer.py   watcher.py           │
│  indexserver/heartbeat.py start_server.py                   │
│  Venv (WSL only): ~/.local/indexserver-venv/                │
│  Entry: ts.cmd (Windows→WSL bridge) / ts.sh (WSL direct)   │
└─────────────────────────────────────────────────────────────┘
                         │  data at ~/.local/typesense/
                    Typesense server (Linux binary)
```

## Module map

### Client-side (`codesearch/`)

| File | Responsibility |
|------|---------------|
| `config.py` | Shared constants: `HOST`, `PORT`, `API_KEY`, `ROOTS`, `COLLECTION`, `INCLUDE_EXTENSIONS`. Reads `config.json`. Provides `get_root(name)` → `(collection, src_path)` and `collection_for_root(name)` → `"codesearch_{name}"`. |
| `search.py` | HTTP search wrapper. `search(query, ...)` builds params and calls Typesense; `format_results()` prints human-readable output. Used by `mcp_server.py`. |
| `query.py` | Tree-sitter AST query functions (`q_classes`, `q_methods`, `q_calls`, `q_implements`, `q_field_type`, `q_param_type`, `q_casts`, `q_ident`, `q_uses`, `q_attrs`, `q_usings`, `q_find`, `q_params`). `process_file(path, mode, mode_arg, ...)` dispatches to them and prints matches. `files_from_search()` resolves Typesense hits to local file paths. |
| `mcp_server.py` | FastMCP server. Exposes `search_code` and `query_cs` tools. Captures stdout with `StringIO`. Supports multi-root via `root=` parameter. |

### Server-side (`codesearch/indexserver/`)

| File | Responsibility |
|------|---------------|
| `config.py` | Same constants as client `config.py` — reads the same `codesearch/config.json`. Also has `INCLUDE_EXTENSIONS`, `EXCLUDE_DIRS`, `MAX_FILE_BYTES`, `MAX_CONTENT_CHARS`. Imported by all indexserver modules. |
| `indexer.py` | One-shot full index. `run_index(src_root, collection, reset, verbose)` walks the source tree via `os.walk` + `.gitignore` parsing (`pathspec`), calls tree-sitter via `extract_cs_metadata()`, batches upserts into Typesense. `build_schema(name)` returns the collection schema. |
| `watcher.py` | Incremental updates. `PollingObserver` monitors source root and upserts changed files. Uses `PollingObserver` (not inotify) because source is on a Windows-backed `/mnt/` path. |
| `heartbeat.py` | Health loop. Checks Typesense liveness every 30 s and restarts watcher or server if needed. |
| `start_server.py` | Downloads the Typesense Linux binary to `~/.local/typesense/` on first run, starts the process, writes PID to `~/.local/typesense/typesense.pid`. |
| `service.py` | CLI: `start`, `stop`, `status`, `restart`, `index [--reset]`, `log`, `watcher`. All process management (PIDs, kill, health) is WSL-native using `os.kill`. |
| `smoke_test.py` | Quick sanity check that the server is up and basic queries work. |

## Entry points

| Command | What it does |
|---------|-------------|
| `codesearch/ts.cmd <cmd>` | Windows CMD/PowerShell → WSL bridge. Strips trailing `\` from `%~dp0`, converts with `wslpath -u`, then runs `ts.sh` in WSL. |
| `codesearch/ts.sh <cmd>` | WSL / Git Bash entry point. From Git Bash: `MSYS_NO_PATHCONV=1 wsl.exe bash -l /mnt/q/.../codesearch/ts.sh <cmd>`. |
| `codesearch/mcp.cmd` | Runs `mcp_server.py` under `.venv/Scripts/python.exe` (Windows). |
| `codesearch/mcp.sh` | Runs `mcp_server.py` under `~/.local/mcp-venv/bin/python` (WSL). |
| `codesearch/setup_mcp.cmd <src-dir>` | One-time setup: writes `config.json`, creates venvs, registers MCP with Claude Code. |
| `codesearch/smoke-test.cmd` | Runs `indexserver/smoke_test.py` via WSL indexserver venv. |
| `codesearch/run-server-tests.cmd [filter]` | Runs `tests/test_indexserver.py` via WSL indexserver venv + pytest. |

## Venvs

| Venv | Location | Used by | Packages |
|------|----------|---------|----------|
| MCP (WSL) | `~/.local/mcp-venv/` | `mcp.sh` → `mcp_server.py` — **used by Claude Code VSCode ext** | `mcp`, `tree_sitter_c_sharp`, `tree_sitter` |
| MCP (Windows) | `codesearch/.venv/` | `mcp.cmd` → `mcp_server.py` — alternative, not used by extension | same as above |
| Indexserver | `~/.local/indexserver-venv/` | `ts.cmd/ts.sh` → all indexserver modules | `typesense`, `tree_sitter_c_sharp`, `tree_sitter`, `watchdog`, `pathspec`, `pytest` |

> **The indexserver and MCP client have separate tree-sitter parsers.** Both parse C# correctly — they just run in different processes. Do not confuse `codesearch.query` (MCP-side) with `codesearch.indexserver.indexer` (indexer-side) when tracing a bug.

> **MCP runs in WSL; CLI can be Windows or WSL.** The Claude Code VSCode extension always launches `mcp.sh`, so `mcp_server.py` runs as a Linux process (`sys.platform == "linux"`). Direct CLI invocations of `query.py` or `search.py` can run under either the Windows venv or the WSL venv. Both are supported — `config.to_native_path()` converts `X:/...` ↔ `/mnt/x/...` based on `sys.platform`.

## config.json

Shared by both layers. Located at `codesearch/config.json`.

```json
{
  "api_key": "codesearch-local",
  "roots": {
    "default": "C:/myproject/src"
  }
}
```

Old single-root format (`"src_root": "..."`) is auto-promoted to `roots.default` in memory — no file change needed to keep it working.

## Collection naming

`collection_for_root(name)` → `"codesearch_{sanitized_name}"` where sanitized = lowercase alphanumeric + underscores.

Default root → `codesearch_default`. Both `config.py` files compute this identically.

> **After upgrading from the old single-collection setup** (`codesearch_files`), run `ts index --reset` once to create the new `codesearch_default` collection. The `codesearch_files` name is no longer used.

## Typesense schema — search mode mapping

| `search_code` mode | `query_by` field(s) | What it finds |
|--------------------|---------------------|---------------|
| `text` (default) | `filename`, `class/method_names`, `content` | Broad keyword search |
| `symbols` | `filename`, `class/method_names` only | Faster, no content noise |
| `implements` | `base_types` (T1) | Files where a type inherits/implements the query |
| `callers` | `call_sites` (T1) | Files that call the query method |
| `sig` | `method_sigs` (T1) | Methods whose signature contains the query |
| `uses` | `type_refs` (T2) | Files that reference the query type in declarations |
| `attr` | `attributes` (T2) | Files decorated with the query attribute |

T1 fields (`base_types`, `call_sites`, `method_sigs`) are precise tree-sitter extractions.
T2 fields (`type_refs`, `attributes`, `usings`) are broader and may have minor false positives.

## tree-sitter query modes (query.py / query_cs MCP tool)

`process_file(path, mode, mode_arg, show_path, count_only, context, src_root)` dispatches to:

| Mode | mode_arg | Finds |
|------|----------|-------|
| `classes` | — | All type declarations with base types |
| `methods` | — | All method/ctor/property/field signatures |
| `fields` | — | All field and property declarations |
| `calls` | METHOD | Every call site of METHOD |
| `implements` | TYPE | Types that inherit/implement TYPE |
| `uses` | TYPE | Every line where TYPE appears as a type reference |
| `field_type` | TYPE | Fields/properties whose declared type is TYPE |
| `param_type` | TYPE | Method parameters typed as TYPE |
| `casts` | TYPE | Every explicit `(TYPE)expr` cast |
| `ident` | NAME | Every identifier occurrence (semantic grep) |
| `attrs` | NAME? | `[Attribute]` decorators, optionally filtered |
| `usings` | — | All using directives |
| `find` | NAME | Full source of method/type named NAME |
| `params` | METHOD | Parameter list of METHOD |

## Testing

All tests are in `codesearch/tests/test_indexserver.py`. Run via **WSL indexserver venv**:

```bash
# All tests (requires Typesense running: ts start)
~/.local/indexserver-venv/bin/pytest codesearch/tests/test_indexserver.py -v

# A specific class
~/.local/indexserver-venv/bin/pytest codesearch/tests/test_indexserver.py::TestQueryCs -v
```

Or from Windows:
```
codesearch\run-server-tests.cmd
codesearch\run-server-tests.cmd TestQueryCs
```

Test classes:

| Class | Server needed | Tests |
|-------|--------------|-------|
| `TestIndexer` | yes | Collection creation, file count, paths, priority, reset |
| `TestSemanticFields` | yes | All indexed fields: base_types, call_sites, method_sigs, type_refs, attrs, usings, namespace |
| `TestMultiRoot` | yes | Two independent collections from the same source tree |
| `TestExtractCsMetadata` | no | Unit tests for tree-sitter extractor directly |
| `TestSearchFieldModes` | yes | Each MCP search mode's `query_by` field returns the right file |
| `TestQueryCs` | no | All `process_file()` modes + consistency between indexer and query.py extraction |

## Common gotchas

**MCP server runs in WSL — file paths must be `/mnt/x/...` inside the process.** `config.json` stores roots as Windows paths (`X:/...`) because `setup_mcp.cmd` writes them from Windows. At runtime, `config.to_native_path()` converts them to the platform-native format: `/mnt/x/...` on Linux, `X:/...` on Windows. If you add any new code that constructs file paths from `SRC_ROOT`, wrap it with `to_native_path()`. This is the root cause of why `files=` glob and `files_from_search()` failed silently before the fix — they produced `c:/myproject/src/...` paths which don't exist in WSL.

**Two `config.py` files that look identical but serve different roles:**
- `codesearch/config.py` — imported by MCP client (`search.py`, `query.py`, `mcp_server.py`)
- `codesearch/indexserver/config.py` — imported by all indexserver modules

Both read the same `codesearch/config.json`. If you update config logic, update both.

**`walk_source_files` uses `os.walk` + `.gitignore` parsing (via `pathspec`).** No git is required. Each `.gitignore` found during the walk is loaded and applied relative to its own directory. `EXCLUDE_DIRS` from config prunes directories before gitignore patterns are checked.

**`PollingObserver` in watcher.** The watcher polls every 10 s instead of using inotify because the source tree is on `/mnt/q/` (Windows-backed NTFS). Don't switch to `Observer` — inotify doesn't fire for changes made on the Windows side.

**stdout capture in mcp_server.py.** `format_results()` and `process_file()` print to stdout. `mcp_server.py` captures with `StringIO`. Don't refactor these to return strings — the CLI entry points in `query.py` depend on the print-based interface.

**PID files live in WSL.** `~/.local/typesense/typesense.pid`, `~/.local/typesense/watcher_default.pid`, etc. They are not in the Windows repo directory. `service.py` uses `os.kill(pid, 0)` (WSL-native) to check liveness.

**cmd→WSL path conversion: never pass a trailing backslash to wslpath.** `%~dp0` always ends with `\`, so `wsl wslpath -u "%~dp0"` produces `"Q:\path\"` where the `\"` is parsed by CommandLineToArgvW as an escaped quote, leaving the string unclosed. Always strip the trailing backslash first:
```cmd
set "_WIN=%~dp0"
for /f "usebackq tokens=*" %%W in (`wsl wslpath -u "%_WIN:~0,-1%"`) do set "_WSLDIR=%%W/"
```
The explicit `%%W/` re-adds the trailing slash after wslpath (which strips it).

**Shell script `$REPO` is relative to the script's own location.** If `ts.sh` lives in `codesearch/`, then `REPO=$(dirname $0)` = `.../claudeskills/codesearch` — do not prepend `codesearch/` again when building paths to `indexserver/service.py`.

**Running `ts.sh` from the Claude Code Bash tool (Git Bash).** The Bash tool runs in Git Bash, which automatically converts `/mnt/q/...` paths to Windows paths before passing them to `wsl.exe`. This breaks WSL invocation. Always use:
```bash
MSYS_NO_PATHCONV=1 wsl.exe bash -l /mnt/c/myproject/claudeskills/codesearch/ts.sh <cmd>
```
`MSYS_NO_PATHCONV=1` disables Git Bash path conversion for that command. `ts.cmd` cannot be invoked from the Bash tool (it requires Windows cmd.exe).

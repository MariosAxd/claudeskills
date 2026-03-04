# codesearch

Full-text and structural code search for a large monorepo. Runs a [Typesense](https://typesense.org) search server in WSL and exposes results as MCP tools so Claude can query the codebase directly without copy-pasting.

## Prerequisites

- Windows 11 with WSL2
- Python 3.10+ available in WSL (`python3 --version`)
- Git available in both Windows and WSL

## One-time setup

### 1. Register the MCP server and create venvs

From a Windows command prompt, run:

```
codesearch\setup_mcp.cmd <path-to-your-source-root>
```

Example:
```
codesearch\setup_mcp.cmd Q:\myrepo\src
```

This will:
- Write `codesearch\config.json` with your source root path and API key
- Create the Windows MCP venv at `codesearch\.venv\`
- Create the WSL indexserver venv at `~/.local/indexserver-venv/`
- Register `mcp.cmd` with Claude Code

Reload VS Code after running (`Ctrl+Shift+P` → Developer: Reload Window).

### 2. Start the service and build the index

```
ts start          # starts Typesense (WSL), watcher, and heartbeat
```

On first start, `ts start` automatically detects the missing collection and kicks off the indexer. You can also trigger it manually:

```
ts index --reset  # drop + recreate collection, then re-index
```

Initial indexing of a large repo (~100k files) takes 30–40 minutes.

## Service management

All service commands go through `codesearch\ts.cmd` (Windows CMD/PowerShell) or `codesearch/ts.sh` (Git Bash / WSL):

```
ts status                   show server health, doc count, watcher/heartbeat state
ts start                    start Typesense + watcher + heartbeat (auto-indexes if needed)
ts stop                     stop everything
ts restart                  stop then start
ts index                    re-index in background (incremental, keeps existing collection)
ts index --reset            drop + recreate collection, then re-index
ts index --root <name>      index a specific named root (multi-root setups)
ts log                      tail the Typesense server log
ts log --indexer [-n N]     tail the indexer log (default: last 40 lines)
ts log --heartbeat          tail the heartbeat log
ts watcher                  start the file watcher standalone
ts heartbeat                start the heartbeat watchdog standalone
```

## Multi-root configuration

To index multiple source trees, edit `codesearch\config.json`:

```json
{
  "api_key": "codesearch-local",
  "roots": {
    "default": "X:/path/to/first/src",
    "other":   "Y:/path/to/second/src"
  }
}
```

Each root gets its own Typesense collection (`codesearch_default`, `codesearch_other`). Index each one:

```
ts index --root default --reset
ts index --root other   --reset
ts restart
```

Use the MCP `root=` parameter to search a specific collection:
```
search_code("BlobStore", root="other")
query_cs("implements", "IFoo", root="other")
```

## Running tests

Requires Typesense running (`ts start`):

```
codesearch\run-server-tests.cmd                    # all tests
codesearch\run-server-tests.cmd TestSearchFieldModes  # specific class
codesearch\run-server-tests.cmd test_method_sigs      # specific method
```

Or directly from WSL:
```bash
~/.local/indexserver-venv/bin/pytest codesearch/tests/test_indexserver.py -v
```

## Direct CLI usage

### Full-text search (`search.py`)

```bash
# From the claudeskills directory, using the Windows venv:
.venv\Scripts\python.exe codesearch\search.py "MyInterface"
.venv\Scripts\python.exe codesearch\search.py "MyMethod" --ext cs --sub mysubsystem
.venv\Scripts\python.exe codesearch\search.py "MyInterface" --mode implements
.venv\Scripts\python.exe codesearch\search.py "MyMethod"   --mode callers
.venv\Scripts\python.exe codesearch\search.py "Obsolete"   --mode attr
.venv\Scripts\python.exe codesearch\search.py "MyType"     --mode uses
```

### Structural C# AST queries (`query.py`)

```bash
.venv\Scripts\python.exe codesearch\query.py --methods   MyClass.cs
.venv\Scripts\python.exe codesearch\query.py --calls     MyMethod  "src/mysubsystem/**/*.cs"
.venv\Scripts\python.exe codesearch\query.py --implements IMyInterface --search "IMyInterface"
.venv\Scripts\python.exe codesearch\query.py --field-type MyType       --search "MyType"
.venv\Scripts\python.exe codesearch\query.py --param-type MyType       --search "MyType"
.venv\Scripts\python.exe codesearch\query.py --uses      MyType        --search "MyType"
.venv\Scripts\python.exe codesearch\query.py --find      MyMethod      MyClass.cs
.venv\Scripts\python.exe codesearch\query.py --attrs     TestMethod    "src/**/*.cs"
```

## Architecture

### Two-layer search

1. **Typesense** — fast keyword/semantic search over pre-indexed metadata (class names, method names, base types, call sites, signatures, attributes, etc.). Runs in WSL; data stored at `~/.local/typesense/`.

2. **tree-sitter** — precise C# AST queries on the file set returned by Typesense. Skips comments and string literals, understands syntax.

Typical flow: Typesense narrows the haystack to ~50 candidate files → tree-sitter parses each one and applies the structural query.

### Process topology

```
┌─────────────────────────────────────────────────┐
│  MCP CLIENT  (Claude ↔ tools)                   │
│  mcp_server.py   search.py   query.py           │
│  Claude Code VSCode ext → mcp.sh  (WSL)  ← actual
│  Manual/CI alternative  → mcp.cmd (Windows)     │
│  Venv (WSL):     ~/.local/mcp-venv/             │
│  Venv (Windows): codesearch/.venv/              │
└───────────────────┬─────────────────────────────┘
                    │ HTTP localhost:8108
┌───────────────────▼─────────────────────────────┐
│  INDEXSERVER  (WSL only)                        │
│  indexserver/service.py    indexer.py           │
│  indexserver/watcher.py    heartbeat.py         │
│  Venv: ~/.local/indexserver-venv/               │
│  Entry: ts.cmd (Windows) / codesearch/ts.sh     │
└─────────────────────────────────────────────────┘
                    │ data
             Typesense server
          ~/.local/typesense/
```

> **MCP runs in WSL.** The Claude Code VSCode extension launches the MCP server via `mcp.sh`, so `mcp_server.py` runs under the WSL Python (`~/.local/mcp-venv`). This means file paths inside the MCP process must be `/mnt/x/...` style, even though `config.json` stores them as Windows `X:/...` paths. `config.to_native_path()` converts automatically based on `sys.platform`.
>
> Direct CLI usage (`query.py`, `search.py` invoked by hand) can run under either Windows or WSL depending on which Python you call — both are supported.

### File map

**Client-side (`codesearch/`)**

| File | Purpose |
|------|---------|
| `config.py` | Shared constants: HOST, PORT, API_KEY, ROOTS, collection names. Reads `config.json`. |
| `search.py` | Typesense HTTP search; `search()` + `format_results()` |
| `query.py` | tree-sitter AST query functions + `process_file()` + `files_from_search()` |
| `mcp_server.py` | FastMCP server: `search_code`, `query_cs`, `service_status` tools |
| `mcp.cmd` | Windows launcher: `codesearch\.venv\Scripts\python.exe mcp_server.py` |
| `mcp.sh` | WSL launcher: `~/.local/mcp-venv/bin/python mcp_server.py` |
| `setup_mcp.cmd` | One-time setup: writes config.json, creates venvs, registers MCP |

**Server-side (`codesearch/indexserver/`)**

| File | Purpose |
|------|---------|
| `config.py` | Same constants as client config.py; also has INCLUDE_EXTENSIONS, EXCLUDE_DIRS, MAX_FILE_BYTES |
| `indexer.py` | Full re-index via `git ls-files` + tree-sitter C# metadata extraction |
| `watcher.py` | Incremental updates: PollingObserver monitors source root and upserts changes |
| `heartbeat.py` | Health loop: checks server every 30s, restarts watcher or server on failure |
| `start_server.py` | Downloads Typesense Linux binary; starts server process in WSL |
| `service.py` | CLI dispatcher for all `ts` subcommands |
| `smoke_test.py` | Quick sanity check that the server is up and basic queries work |

**Entry points**

| File | Purpose |
|------|---------|
| `ts.cmd` | Windows CMD/PowerShell → WSL bridge for all service commands |
| `ts.sh` | WSL / Git Bash entry point for service commands |
| `smoke-test.cmd` | Run smoke_test.py via WSL |
| `run-server-tests.cmd` | Run pytest test suite via WSL |

### Typesense schema

The collection uses tiered semantic fields extracted by tree-sitter at index time:

| Tier | Fields | Used by MCP mode |
|------|--------|-----------------|
| T1 | `base_types` | `implements` |
| T1 | `call_sites` | `callers` |
| T1 | `method_sigs` | `sig` |
| T2 | `type_refs` | `uses` |
| T2 | `attributes` | `attr` |
| T2 | `usings` | — |
| — | `class_names`, `method_names`, `symbols` | `text`, `symbols` |
| — | `content` | `text` |

Search ranking by file type: `.cs` (priority 3) → `.h/.cpp/.c` (2) → scripts/`.py/.ts` (1) → config/docs (0).

The `subsystem` field is the first path component under the source root. Use `sub=` to scope searches to a subsystem.

### config.json

```json
{
  "api_key": "codesearch-local",
  "roots": {
    "default": "X:/path/to/your/src"
  }
}
```

This file is **not checked in** (listed in `.gitignore`) — it contains your local source root path. Run `setup_mcp.cmd <src-root>` to generate it.

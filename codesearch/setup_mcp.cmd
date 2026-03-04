@echo off
:: Register (or unregister) the codesearch MCP server with Claude Code.
::
:: Usage:
::   setup_mcp.cmd <src-dir>         -- install: write config.json, create Windows venv, register MCP
::   setup_mcp.cmd --uninstall       -- unregister MCP server (venv is left in place)
setlocal

set "REPO=%~dp0"
set "REPO=%REPO:~0,-1%"
set "VENV=%REPO%\.venv"

:: ── Uninstall path ─────────────────────────────────────────────────────────
if /i "%~1"=="--uninstall" (
    echo Removing codesearch MCP server ...
    claude mcp remove --scope user tscodesearch
    if errorlevel 1 (
        echo WARNING: claude mcp remove failed ^(server may not have been registered^).
    ) else (
        echo Done. Restart Claude Code for the change to take effect.
    )
    goto :eof
)

:: ── Require src-dir argument ───────────────────────────────────────────────
if "%~1"=="" (
    echo Usage: setup_mcp.cmd ^<src-dir^> [api-key]
    echo   src-dir  Windows path to the source tree to index ^(e.g. C:\myproject\src^)
    echo   api-key  Typesense API key ^(default: codesearch-local^)
    exit /b 1
)

set "SRC_DIR=%~1"
set "API_KEY=codesearch-local"
if not "%~2"=="" set "API_KEY=%~2"

:: ── [1/3] Write config.json ────────────────────────────────────────────────
::
:: Config format (new - supports multiple named source roots):
::   {
::     "api_key": "<key>",
::     "roots": {
::       "default": "C:/myproject/src",
::       "myother": "C:/other/src"
::     }
::   }
::
:: Legacy format (still supported - auto-promoted to roots.default at runtime):
::   { "src_root": "C:/myproject/src", "api_key": "<key>" }
::
:: To add more roots after setup: edit config.json, add entries under "roots",
:: then run: ts.cmd index --root <name> --reset
::
echo.
echo [1/3] Writing codesearch/config.json ...
set "SRC_FWD=%SRC_DIR:\=/%"
(echo {) > "%REPO%\config.json"
(echo   "api_key": "%API_KEY%",) >> "%REPO%\config.json"
(echo   "roots": {) >> "%REPO%\config.json"
(echo     "default": "%SRC_FWD%") >> "%REPO%\config.json"
(echo   }) >> "%REPO%\config.json"
(echo }) >> "%REPO%\config.json"
if errorlevel 1 (
    echo ERROR: Failed to write config.json.
    exit /b 1
)
echo   root[default] = %SRC_FWD%
echo   api_key       = %API_KEY%

:: ── [2/3] Create Windows venv ──────────────────────────────────────────────
echo.
echo [2/3] Creating Windows venv at %VENV% ...
python -m venv "%VENV%"
if errorlevel 1 (
    echo ERROR: Failed to create venv. Is Python 3.10+ in PATH?
    exit /b 1
)
echo   Installing packages ...
"%VENV%\Scripts\pip.exe" install --quiet --upgrade mcp tree-sitter tree-sitter-c-sharp
if errorlevel 1 (
    echo ERROR: pip install failed.
    exit /b 1
)
echo   Packages installed.

:: ── [3/3] Register MCP ────────────────────────────────────────────────────
echo.
echo [3/3] Registering MCP server with Claude Code ...
claude mcp remove --scope user tscodesearch >nul 2>&1
claude mcp add --scope user tscodesearch -- "%VENV%\Scripts\python.exe" "%REPO%\mcp_server.py"
if errorlevel 1 (
    echo ERROR: Failed to register MCP server.
    exit /b 1
)

echo.
echo Done. Restart Claude Code for the change to take effect.
echo.
echo Next steps:
echo   ts.cmd start                         -- start Typesense server + watcher
echo   ts.cmd index --reset                 -- index the default root ^(required after first setup^)
echo   ts.cmd index --root ^<name^> --reset  -- index a specific named root
echo   ts.cmd status                        -- show per-root collection stats
endlocal

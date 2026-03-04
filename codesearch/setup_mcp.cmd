@echo off
:: Register (or unregister) the codesearch MCP server with Claude Code.
::
:: Usage:
::   setup_mcp.cmd <src-dir>         -- install: write config.json, create venvs (WSL + Windows), register MCP
::   setup_mcp.cmd --uninstall       -- unregister MCP server (venvs are left in place)
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

:: ── Check WSL is installed and functional ──────────────────────────────────
where wsl.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: wsl.exe not found in PATH.
    echo        WSL is required to run the Typesense server.
    echo        Install WSL: wsl --install
    exit /b 1
)
wsl.exe --status >nul 2>&1
if errorlevel 1 (
    echo ERROR: WSL is installed but not functional ^(wsl --status failed^).
    echo        Try: wsl --install  or  wsl --update
    exit /b 1
)
:: Quick sanity-check: can WSL actually run a shell command?
wsl.exe bash -c "exit 0" >nul 2>&1
if errorlevel 1 (
    echo ERROR: WSL is installed but cannot run bash.
    echo        Ensure a Linux distribution is installed: wsl --install -d Ubuntu
    exit /b 1
)

:: ── Require src-dir argument ───────────────────────────────────────────────
if "%~1"=="" (
    echo Usage: setup_mcp.cmd ^<src-dir^> [api-key]
    echo   src-dir  Windows path to the source tree to index ^(e.g. C:\myproject\src^)
    echo   api-key  Typesense API key ^(optional; random 40-char hex key generated if omitted^)
    exit /b 1
)

set "SRC_DIR=%~1"

:: ── [1/3] Write config.json (first-time only) ─────────────────────────────
::
:: Config format (new - supports multiple named source roots):
::   {
::     "api_key": "<randomly generated 40-char hex key>",
::     "port": 8108,
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
echo [1/5] Writing codesearch/config.json ...
set "SRC_FWD=%SRC_DIR:\=/%"

if exist "%REPO%\config.json" (
    echo   config.json already exists ^(delete it to regenerate^).
    goto :step2
)

:: Generate random 20-byte hex API key (unless caller passed an explicit one)
set "API_KEY=%~2"
if "%API_KEY%"=="" (
    for /f "usebackq delims=" %%K in (`powershell -NoProfile -Command "[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(20)).Replace('-','').ToLower()"`) do set "API_KEY=%%K"
)

:: Find a free port starting from 8108
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p=8108; $used=([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()|ForEach-Object{$_.Port}); while($p -in $used){$p++}; $p"`) do set "PORT=%%P"
if "%PORT%"=="" set "PORT=8108"

(echo {) > "%REPO%\config.json"
(echo   "api_key": "%API_KEY%",) >> "%REPO%\config.json"
(echo   "port": %PORT%,) >> "%REPO%\config.json"
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
echo   port          = %PORT%

:step2

:: ── [2/5] Create WSL venvs (mcp-venv + indexserver-venv) ──────────────────
echo.
echo [2/5] Creating WSL venvs via setup_mcp.sh ...
for /f "usebackq delims=" %%P in (`wsl.exe wslpath -u "%REPO%"`) do set "WSL_REPO=%%P"
if "%WSL_REPO%"=="" (
    echo ERROR: Could not convert repo path to WSL path.
    echo        Path attempted: %REPO%
    exit /b 1
)
wsl.exe bash "%WSL_REPO%/setup_mcp.sh"
if errorlevel 1 (
    echo ERROR: WSL venv setup failed. See messages above.
    exit /b 1
)

:: ── [3/5] Create Windows venv ──────────────────────────────────────────────
echo.
echo [3/5] Creating Windows venv at %VENV% ...
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

:: ── [4/5] Register MCP ────────────────────────────────────────────────────
echo.
echo [4/5] Registering MCP server with Claude Code ...
claude mcp remove --scope user tscodesearch >nul 2>&1
claude mcp add --scope user tscodesearch -- "%VENV%\Scripts\python.exe" "%REPO%\mcp_server.py"
if errorlevel 1 (
    echo ERROR: Failed to register MCP server.
    exit /b 1
)

:: ── [5/5] Start indexserver ───────────────────────────────────────────────
echo.
echo [5/5] Starting indexserver ^(Typesense + watcher + indexer^) ...
call "%REPO%\ts.cmd" start
if errorlevel 1 (
    echo ERROR: Failed to start indexserver.
    echo        Check logs: ts.cmd log
    echo        Check logs: ts.cmd log --indexer
    exit /b 1
)

echo.
echo Done. Restart Claude Code for the change to take effect.
echo.
echo Indexing is running in the background. Monitor progress with:
echo   ts.cmd status                        -- server health + indexing progress
echo   ts.cmd log --indexer                 -- tail indexer log
echo.
echo Other commands:
echo   ts.cmd stop / restart                -- manage the indexserver
echo   ts.cmd index --reset                 -- re-index the default root from scratch
echo   ts.cmd index --root ^<name^> --reset  -- re-index a specific named root
endlocal

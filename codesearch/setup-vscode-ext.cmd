@echo off
:: Setup and install the codesearch VS Code extension.
:: Run once, then reload VS Code.
::
:: Requires: Node.js (node/npm on PATH)
::           Optional: @vscode/vsce for packaging  (npm install -g @vscode/vsce)

setlocal
set "EXT_DIR=%~dp0vscode-codesearch"

echo [1/3] Installing npm dependencies...
pushd "%EXT_DIR%"
call npm install --no-fund --no-audit
if errorlevel 1 (echo ERROR: npm install failed & exit /b 1)

echo [2/3] Compiling TypeScript...
call npm run compile
if errorlevel 1 (echo ERROR: compile failed & exit /b 1)
popd

echo [3/3] Installing extension into VS Code...
:: Try vsce package + code --install-extension
where vsce >nul 2>&1
if %errorlevel% equ 0 (
    pushd "%EXT_DIR%"
    call vsce package --no-dependencies -o codesearch.vsix
    if errorlevel 1 (echo ERROR: vsce package failed & exit /b 1)
    code --install-extension codesearch.vsix
    del codesearch.vsix
    popd
    echo.
    echo Done! Reload VS Code and run "Code Search: Open Panel" (Ctrl+Shift+F1).
) else (
    echo.
    echo NOTE: @vscode/vsce not found. The extension is compiled but not packaged.
    echo To install manually, open VS Code, press F1, choose:
    echo   "Developer: Install Extension from Location..."
    echo and select: %EXT_DIR%
    echo.
    echo (Or run:  npm install -g @vscode/vsce  and re-run this script.)
)
endlocal

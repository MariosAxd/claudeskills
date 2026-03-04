@echo off
:: Windows CMD wrapper — delegates to setup_mcp.sh via WSL.
:: WSL is required: node_modules and Chrome must live on the Linux filesystem.
for /f "delims=" %%p in ('wsl wslpath -u "%~dp0setup_mcp.sh"') do set WSL_SCRIPT=%%p
wsl bash "%WSL_SCRIPT%" --prefer-windows

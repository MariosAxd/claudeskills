@echo off
:: Typesense service manager CLI for code search.
:: Wraps indexserver/service.py with the WSL indexserver venv.
::
:: Usage:
::   ts.cmd status
::   ts.cmd start
::   ts.cmd stop
::   ts.cmd restart
::   ts.cmd index [--reset] [--root <name>]
::   ts.cmd log [--indexer] [--heartbeat] [-n N]
::   ts.cmd watcher
::   ts.cmd heartbeat
set "_WIN=%~dp0"
for /f "usebackq tokens=*" %%W in (`wsl wslpath -u "%_WIN:~0,-1%"`) do set "_WSLDIR=%%W/"
wsl bash -l "%_WSLDIR%ts.sh" %*

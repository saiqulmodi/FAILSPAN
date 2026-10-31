@echo off
rem Opens FAILSPAN in the browser from this folder (close this window to stop).
cd /d "%~dp0"
start "" http://127.0.0.1:8793/index.html
python -m http.server 8793 --bind 127.0.0.1

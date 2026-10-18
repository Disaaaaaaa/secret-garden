@echo off
rem The Secret Garden - double-click to start (Windows)
cd /d "%~dp0"
echo The Secret Garden is running at http://localhost:8080
echo Close this window to stop.
start "" http://localhost:8080
python -m http.server 8080

@echo off
title Ophiel Local Server
echo Starting local server on http://localhost:8000

:: Change directory to the folder this .bat file is in
cd /d %~dp0

:: Start the Python HTTP server
start "" http://localhost:8000/Dossier1test_apr27.html
python -m http.server 8000
pause
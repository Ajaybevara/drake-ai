@echo off
cd /d "%~dp0frontend"
"C:\Program Files\nodejs\npm.cmd" run dev >> "%~dp0frontend-3000.log" 2>> "%~dp0frontend-3000.err.log"

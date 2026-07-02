@echo off
cd /d "%~dp0backend"
set PYTHONUTF8=1
set MPLCONFIGDIR=%~dp0.codex_tmp_matplotlib
"%~dp0backend\.venv_codex\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --log-level info >> "%~dp0backend-8002.log" 2>> "%~dp0backend-8002.err.log"

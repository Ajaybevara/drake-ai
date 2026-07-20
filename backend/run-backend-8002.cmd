@echo off
cd /d "%~dp0"
".venv_codex\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --log-level info > backend-8002.log 2> backend-8002.err.log

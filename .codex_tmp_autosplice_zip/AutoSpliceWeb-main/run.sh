#!/bin/bash
set -e
PORT=${PORT:-5001}
APP_FILE="app.py"
if [ "$1" == "stop" ]; then pkill -f "python3 $APP_FILE" || true; exit 0; fi
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
if command -v pyenv &>/dev/null; then eval "$(pyenv init -)"; fi
if [ ! -d ".venv" ]; then pyenv local 3.12.1; ~/.pyenv/versions/3.12.1/bin/python -m venv .venv || python3 -m venv .venv; fi
source .venv/bin/activate
if [ "$1" != "restart" ]; then pip install --upgrade pip; pip install -r requirements.txt; fi
FLASK_ENV=production PORT="$PORT" nohup python3 $APP_FILE > flask.log 2>&1 &

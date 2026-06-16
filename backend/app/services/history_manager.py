from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


def utc_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def read_history(project_path: str | Path) -> list[dict[str, Any]]:
    path = Path(project_path) / "history.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def write_history(project_path: str | Path, history: list[dict[str, Any]]) -> None:
    path = Path(project_path) / "history.json"
    path.write_text(json.dumps(history, indent=2), encoding="utf-8")


def append_history(
    project_path: str | Path,
    *,
    module_name: str,
    action: str,
    status: str = "success",
    input_file: str | None = None,
    output_file: str | None = None,
    export_file: str | None = None,
    parameters: dict[str, Any] | None = None,
    errors: str | None = None,
    duration: float | None = None,
) -> dict[str, Any]:
    event = {
        "id": str(uuid4()),
        "timestamp": utc_now(),
        "module_name": module_name,
        "action": action,
        "input_file": input_file,
        "output_file": output_file,
        "export_file": export_file,
        "status": status,
        "parameters": parameters or {},
        "errors": errors,
        "duration": duration,
    }
    history = read_history(project_path)
    history.insert(0, event)
    write_history(project_path, history)
    return event

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from .history_manager import append_history, utc_now
from .project_service import read_project, safe_name, sync_history_to_project, write_project


def timestamp_for_file() -> str:
    return utc_now().replace("-", "").replace(":", "").replace("Z", "").replace("T", "_")


def module_folder(module_name: str) -> str:
    return safe_name(module_name).lower()


def save_result(
    project_path: str | Path,
    *,
    module_name: str,
    well_name: str | None,
    prediction_name: str | None,
    extension: str,
    content: str | None = None,
    content_base64: str | None = None,
    result_payload: dict[str, Any] | None = None,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    project_path = Path(project_path)
    module_dir = project_path / "results" / module_folder(module_name)
    module_dir.mkdir(parents=True, exist_ok=True)
    well = safe_name(well_name or "UNKNOWN_WELL")
    label = safe_name(prediction_name or module_name)
    ext = extension.lower().lstrip(".") or "json"
    target = module_dir / f"{well}_{label}_{timestamp_for_file()}.{ext}"
    if content_base64:
        target.write_bytes(base64.b64decode(content_base64))
    elif content is not None:
        target.write_text(content, encoding="utf-8")
    else:
        target.write_text(json.dumps(result_payload or {}, indent=2), encoding="utf-8")
    record = {
        "result_id": target.stem,
        "module_name": module_name,
        "prediction_name": prediction_name or module_name,
        "well_name": well_name or "UNKNOWN_WELL",
        "file_name": target.name,
        "file_type": ext.upper(),
        "created_at": utc_now(),
        "project_path": str(target),
        "relative_path": str(target.relative_to(project_path)),
        "size_bytes": target.stat().st_size,
    }
    project = read_project(project_path)
    project.setdefault("generated_results", []).insert(0, record)
    write_project(project)
    append_history(project_path, module_name=module_name, action="analysis", output_file=record["relative_path"], parameters=parameters)
    sync_history_to_project(project_path)
    return record

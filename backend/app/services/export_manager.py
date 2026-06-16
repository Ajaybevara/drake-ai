from __future__ import annotations

import base64
import shutil
from pathlib import Path
from typing import Any

from .history_manager import append_history, utc_now
from .project_service import read_project, safe_name, sync_history_to_project, write_project
from .result_manager import module_folder, timestamp_for_file


def save_export(
    project_path: str | Path,
    *,
    module_name: str,
    export_type: str,
    well_name: str | None = None,
    prediction_name: str | None = None,
    source_file: str | None = None,
    content: str | None = None,
    content_base64: str | None = None,
    extension: str | None = None,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    project_path = Path(project_path)
    export_dir = project_path / "results" / module_folder(module_name) / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    source = Path(source_file) if source_file else None
    ext = (extension or export_type or (source.suffix if source else "txt")).lower().lstrip(".")
    well = safe_name(well_name or "UNKNOWN_WELL")
    label = safe_name(prediction_name or export_type or "export")
    target = export_dir / f"{well}_{safe_name(module_name)}_{label}_{timestamp_for_file()}.{ext}"
    if content_base64:
        target.write_bytes(base64.b64decode(content_base64))
    elif content is not None:
        target.write_text(content, encoding="utf-8")
    elif source and source.exists():
        shutil.copy2(source, target)
    else:
        raise FileNotFoundError("source_file or export content is required")
    record = {
        "export_id": target.stem,
        "module_name": module_name,
        "export_type": export_type,
        "prediction_name": prediction_name,
        "well_name": well_name or "UNKNOWN_WELL",
        "file_name": target.name,
        "file_type": ext.upper(),
        "created_at": utc_now(),
        "source_file": source_file,
        "project_path": str(target),
        "relative_path": str(target.relative_to(project_path)),
        "size_bytes": target.stat().st_size,
    }
    project = read_project(project_path)
    project.setdefault("exported_files", []).insert(0, record)
    write_project(project)
    append_history(project_path, module_name=module_name, action="export", export_file=record["relative_path"], parameters=parameters)
    sync_history_to_project(project_path)
    return record

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import UploadFile

from .history_manager import append_history, utc_now
from .project_service import read_project, safe_name, sync_history_to_project, write_project


UPLOAD_BUCKETS = {
    ".las": "las",
    ".csv": "csv",
    ".xls": "xlsx",
    ".xlsx": "xlsx",
    ".png": "images",
    ".jpg": "images",
    ".jpeg": "images",
    ".tif": "images",
    ".tiff": "images",
    ".pdf": "pdf",
    ".sgy": "segy",
    ".segy": "segy",
}


def file_bucket(filename: str) -> str:
    return UPLOAD_BUCKETS.get(Path(filename).suffix.lower(), "others")


def module_compatible(file_type: str) -> list[str]:
    ext = file_type.lower().lstrip(".")
    mapping = {
        "las": ["Petrophysics", "Facies", "Formation Tops", "CCUS", "Geothermal"],
        "csv": ["Petrophysics", "Facies", "Formation Tops", "CCUS", "Production", "GPT", "SLM"],
        "xls": ["Petrophysics", "Formation Tops", "CCUS", "Production", "GPT", "SLM"],
        "xlsx": ["Petrophysics", "Formation Tops", "CCUS", "Production", "GPT", "SLM"],
        "pdf": ["Digitizer", "OCR", "GPT", "SLM"],
        "png": ["Digitizer", "OCR"],
        "jpg": ["Digitizer", "OCR"],
        "jpeg": ["Digitizer", "OCR"],
        "tif": ["Digitizer", "OCR"],
        "tiff": ["Digitizer", "OCR"],
        "txt": ["GPT", "SLM"],
        "doc": ["GPT", "SLM"],
        "docx": ["GPT", "SLM"],
        "sgy": ["Seismic"],
        "segy": ["Seismic"],
    }
    return mapping.get(ext, ["Platform"])


async def copy_upload(project_path: str | Path, upload: UploadFile) -> dict[str, Any]:
    project_path = Path(project_path)
    bucket = file_bucket(upload.filename or "file")
    upload_dir = project_path / "uploads" / bucket
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = upload_dir / f"{uuid4().hex}_{safe_name(upload.filename or 'uploaded_file')}"
    size = 0
    with target.open("wb") as handle:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            handle.write(chunk)
    ext = target.suffix.lower().lstrip(".") or "file"
    record = {
        "file_id": str(uuid4()),
        "file_name": upload.filename,
        "file_type": ext.upper(),
        "size_bytes": size,
        "uploaded_at": utc_now(),
        "source_path": upload.filename,
        "project_path": str(target),
        "relative_path": str(target.relative_to(project_path)),
        "bucket": bucket,
        "compatibility": module_compatible(ext),
    }
    project = read_project(project_path)
    project.setdefault("uploaded_files", []).insert(0, record)
    write_project(project)
    append_history(project_path, module_name="Platform", action="upload", input_file=record["file_name"], output_file=record["relative_path"])
    sync_history_to_project(project_path)
    return record


def find_file(project: dict[str, Any], file_id: str) -> dict[str, Any]:
    for record in project.get("uploaded_files", []):
        if record.get("file_id") == file_id:
            return record
    raise FileNotFoundError("Project file not found")


def copy_existing_file(project_path: str | Path, source_path: str, display_name: str | None = None) -> dict[str, Any]:
    source = Path(source_path)
    if not source.exists():
        raise FileNotFoundError(source_path)
    bucket = file_bucket(display_name or source.name)
    upload_dir = Path(project_path) / "uploads" / bucket
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = upload_dir / f"{uuid4().hex}_{safe_name(display_name or source.name)}"
    shutil.copy2(source, target)
    ext = target.suffix.lower().lstrip(".") or "file"
    record = {
        "file_id": str(uuid4()),
        "file_name": display_name or source.name,
        "file_type": ext.upper(),
        "size_bytes": target.stat().st_size,
        "uploaded_at": utc_now(),
        "source_path": str(source),
        "project_path": str(target),
        "relative_path": str(target.relative_to(project_path)),
        "bucket": bucket,
        "compatibility": module_compatible(ext),
    }
    project = read_project(project_path)
    project.setdefault("uploaded_files", []).insert(0, record)
    write_project(project)
    append_history(project_path, module_name="Platform", action="upload", input_file=str(source), output_file=record["relative_path"])
    sync_history_to_project(project_path)
    return record

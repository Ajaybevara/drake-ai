from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter()

STORAGE_ROOT = Path.cwd() / "local_project_storage"
UPLOAD_ROOT = STORAGE_ROOT / "uploads"


def _safe_name(name: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_. -]+", "_", name).strip().replace(" ", "_")
    return clean or "drake_project"


def _locations() -> dict[str, Path]:
    home = Path.home()
    return {
        "workspace": STORAGE_ROOT / "projects",
        "desktop": home / "Desktop" / "DrakeAIProjects",
        "documents": home / "Documents" / "DrakeAIProjects",
        "downloads": home / "Downloads" / "DrakeAIProjects",
        "c_drive": Path("C:/DrakeAIProjects"),
    }


def _location_path(key: str) -> Path:
    locations = _locations()
    if key not in locations:
        raise HTTPException(status_code=400, detail="Invalid local storage location")
    path = locations[key]
    path.mkdir(parents=True, exist_ok=True)
    return path


def _classify_file(name: str) -> dict:
    lower = name.lower()
    if lower.endswith(".las"):
        return {"category": "las", "compatibility": ["Petrophysics", "CCUS"], "status": "Parsed"}
    if lower.endswith((".sgy", ".segy", ".npy")):
        return {"category": "seismic", "compatibility": ["Seismic"], "status": "Ready"}
    if lower.endswith((".pdf", ".doc", ".docx")):
        return {"category": "reports", "compatibility": ["CCUS", "Digitizer", "Reports"], "status": "Ready"}
    if lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")):
        return {"category": "images", "compatibility": ["Digitizer"], "status": "Ready"}
    if lower.endswith((".csv", ".xls", ".xlsx")):
        return {"category": "tables", "compatibility": ["Production", "CCUS", "Reports"], "status": "Ready"}
    return {"category": "digitizer", "compatibility": ["Reports"], "status": "Uploaded"}


class SaveProjectPayload(BaseModel):
    location_key: str
    project: dict
    file_name: str | None = None


class OpenProjectPayload(BaseModel):
    path: str


@router.get("/locations")
def list_locations():
    return [
        {"key": key, "label": label, "path": str(path)}
        for key, label, path in [
            ("workspace", "Workspace local storage", _locations()["workspace"]),
            ("desktop", "Desktop", _locations()["desktop"]),
            ("documents", "Documents", _locations()["documents"]),
            ("downloads", "Downloads", _locations()["downloads"]),
            ("c_drive", "C Drive", _locations()["c_drive"]),
        ]
    ]


@router.post("/save")
def save_project(payload: SaveProjectPayload):
    project = payload.project
    project_name = project.get("name") or "drake_project"
    file_name = payload.file_name or f"{_safe_name(project_name)}.drake-project.json"
    if not file_name.lower().endswith(".json"):
        file_name += ".json"

    folder = _location_path(payload.location_key)
    path = folder / _safe_name(file_name)
    package = {
        "schema": "drake-ai-project-package/v1",
        "savedAt": project.get("lastOpenedAt"),
        "project": project,
    }
    path.write_text(json.dumps(package, indent=2), encoding="utf-8")
    return {"status": "saved", "path": str(path), "file_name": path.name}


@router.get("/list")
def list_projects(location_key: str = "workspace"):
    folder = _location_path(location_key)
    projects = []
    for path in sorted(folder.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
            project = parsed.get("project", parsed)
            projects.append({
                "name": project.get("name", path.stem),
                "path": str(path),
                "file_name": path.name,
                "modified": path.stat().st_mtime,
                "files": len(project.get("files", [])),
                "outputs": len(project.get("outputs", [])),
            })
        except Exception:
            continue
    return projects


@router.post("/open")
def open_project(payload: OpenProjectPayload):
    path = Path(payload.path)
    if not path.exists() or path.suffix.lower() != ".json":
        raise HTTPException(status_code=404, detail="Project package not found")
    parsed = json.loads(path.read_text(encoding="utf-8"))
    project = parsed.get("project", parsed)
    if not project.get("name"):
        raise HTTPException(status_code=400, detail="Invalid Drake AI project package")
    return project


@router.post("/files/upload")
async def upload_project_file(file: UploadFile = File(...)):
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    original_name = file.filename or "project_file.bin"
    stored_name = f"{uuid4().hex}_{_safe_name(original_name)}"
    storage_path = UPLOAD_ROOT / stored_name
    with storage_path.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    stat = storage_path.stat()
    return {
        "name": original_name,
        "type": Path(original_name).suffix.replace(".", "").upper() or file.content_type or "FILE",
        "size": stat.st_size,
        "storagePath": str(storage_path),
        "backendReady": True,
        **_classify_file(original_name),
    }

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from .history_manager import append_history, read_history, utc_now


PROJECT_ROOT_NAME = "DrakeAI_Projects"
CURRENT_PROJECT_FILE = ".drake_current_project.json"

PROJECT_TYPES = {
    "Petrophysics",
    "Seismic",
    "Production",
    "CCUS",
    "Geothermal",
    "Digitizer",
    "Integrated Study",
    "Custom",
}

STORAGE_LOCATIONS = {
    "Desktop": lambda: Path.home() / "Desktop",
    "Documents": lambda: Path.home() / "Documents",
    "C Drive": lambda: Path("C:/"),
    "D Drive": lambda: Path("D:/"),
}

PROJECT_SUBDIRS = [
    "uploads/las",
    "uploads/csv",
    "uploads/xlsx",
    "uploads/images",
    "uploads/pdf",
    "uploads/segy",
    "uploads/others",
    "results/petrophysics/exports",
    "results/seismic/exports",
    "results/production/exports",
    "results/geothermal/exports",
    "results/ccus/exports",
    "results/digitizer/exports",
    "results/exports",
    "reports",
]


def safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._ -]+", "_", value.strip())
    cleaned = re.sub(r"\s+", "_", cleaned).strip("._-")
    return cleaned or "Drake_Project"


def default_root() -> Path:
    return Path(os.getenv("DRAKE_PROJECT_ROOT", Path.home() / "Documents" / PROJECT_ROOT_NAME))


def settings_path() -> Path:
    root = default_root()
    root.mkdir(parents=True, exist_ok=True)
    return root / CURRENT_PROJECT_FILE


def location_root(location_key: str, custom_folder: str | None = None) -> Path:
    if location_key == "Custom Folder":
        if not custom_folder:
            raise ValueError("custom_folder is required for Custom Folder storage.")
        return Path(custom_folder).expanduser()
    factory = STORAGE_LOCATIONS.get(location_key)
    if not factory:
        raise ValueError(f"Unsupported storage location: {location_key}")
    return factory() / PROJECT_ROOT_NAME


def ensure_project_dirs(project_path: Path) -> None:
    project_path.mkdir(parents=True, exist_ok=True)
    for subdir in PROJECT_SUBDIRS:
        (project_path / subdir).mkdir(parents=True, exist_ok=True)


def project_json_path(project_path: str | Path) -> Path:
    return Path(project_path) / "project.json"


def read_project(project_path: str | Path) -> dict[str, Any]:
    path = project_json_path(project_path)
    if not path.exists():
        raise FileNotFoundError(f"project.json not found in {project_path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_project(project: dict[str, Any]) -> dict[str, Any]:
    project["updated_at"] = utc_now()
    path = Path(project["project_path"])
    ensure_project_dirs(path)
    project_json_path(path).write_text(json.dumps(project, indent=2), encoding="utf-8")
    return project


def set_current_project(project: dict[str, Any]) -> None:
    settings_path().write_text(
        json.dumps({"project_id": project["project_id"], "project_path": project["project_path"]}, indent=2),
        encoding="utf-8",
    )


def get_current_project() -> dict[str, Any] | None:
    path = settings_path()
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return read_project(payload["project_path"])
    except Exception:
        return None


def create_project(
    *,
    project_name: str,
    description: str,
    project_type: str,
    storage_location: str,
    custom_folder: str | None = None,
) -> dict[str, Any]:
    if project_type not in PROJECT_TYPES:
        raise ValueError(f"Unsupported project type: {project_type}")
    root = location_root(storage_location, custom_folder)
    project_path = root / safe_name(project_name)
    ensure_project_dirs(project_path)
    now = utc_now()
    project = {
        "project_id": str(uuid4()),
        "project_name": project_name,
        "description": description,
        "project_type": project_type,
        "storage_location": storage_location,
        "created_at": now,
        "updated_at": now,
        "project_path": str(project_path),
        "uploaded_files": [],
        "generated_results": [],
        "exported_files": [],
        "module_history": [],
        "dashboard_state": {},
    }
    write_project(project)
    append_history(project_path, module_name="Platform", action="project_create", parameters={"project_type": project_type})
    project["module_history"] = read_history(project_path)
    write_project(project)
    set_current_project(project)
    return read_project(project_path)


def open_project(project_path: str) -> dict[str, Any]:
    path = Path(project_path)
    if path.is_file() and path.name == "project.json":
        path = path.parent
    project = read_project(path)
    project["dashboard_state"] = project.get("dashboard_state") or {}
    project["uploaded_files"] = project.get("uploaded_files") or []
    project["generated_results"] = project.get("generated_results") or []
    project["exported_files"] = project.get("exported_files") or []
    project["module_history"] = project.get("module_history") or []
    write_project(project)
    set_current_project(project)
    return project


def list_projects(location_key: str | None = None, custom_folder: str | None = None) -> list[dict[str, Any]]:
    roots = []
    if location_key:
        roots.append(location_root(location_key, custom_folder))
    else:
        roots.extend([default_root(), Path.home() / "Desktop" / PROJECT_ROOT_NAME, Path.home() / "Documents" / PROJECT_ROOT_NAME])
    projects: list[dict[str, Any]] = []
    seen: set[str] = set()
    for root in roots:
        if not root.exists():
            continue
        for project_file in root.glob("*/project.json"):
            try:
                project = read_project(project_file.parent)
                if project["project_id"] not in seen:
                    projects.append(project)
                    seen.add(project["project_id"])
            except Exception:
                continue
    return sorted(projects, key=lambda item: item.get("updated_at", ""), reverse=True)


def sync_history_to_project(project_path: str | Path) -> dict[str, Any]:
    project = read_project(project_path)
    project["module_history"] = json.loads((Path(project_path) / "history.json").read_text(encoding="utf-8")) if (Path(project_path) / "history.json").exists() else []
    return write_project(project)

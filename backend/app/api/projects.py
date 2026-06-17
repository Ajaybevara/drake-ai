from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Project, User
from app.services import project_service
from app.services.file_registry import copy_upload, find_file
from app.services.result_manager import save_result
from app.services.export_manager import save_export

router = APIRouter()


def frontend_local_projects_only():
    raise HTTPException(
        status_code=410,
        detail=(
            "Local project folders are frontend-only. Use window.showDirectoryPicker() "
            "in the browser and send files to the backend only for processing."
        ),
    )


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    field_name: Optional[str] = None
    basin: Optional[str] = None
    country: Optional[str] = None
    operator: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    field_name: Optional[str]
    basin: Optional[str]
    country: Optional[str]
    operator: Optional[str]
    well_count: int = 0

    class Config:
        from_attributes = True


class EnterpriseProjectCreate(BaseModel):
    project_name: str
    description: str = ""
    project_type: str = "Integrated Study"
    storage_location: str = "Documents"
    custom_folder: Optional[str] = None


class EnterpriseProjectOpen(BaseModel):
    project_path: str


class StoragePathRequest(BaseModel):
    storage_location: str
    custom_folder: Optional[str] = None


class SaveResultRequest(BaseModel):
    project_id: Optional[str] = None
    module_name: str
    well_name: Optional[str] = None
    prediction_name: Optional[str] = None
    extension: str = "json"
    content: Optional[str] = None
    content_base64: Optional[str] = None
    result_payload: Optional[dict] = None
    parameters: Optional[dict] = None


class SaveExportRequest(BaseModel):
    project_id: Optional[str] = None
    module_name: str
    source_file: Optional[str] = None
    export_type: str
    well_name: Optional[str] = None
    prediction_name: Optional[str] = None
    content: Optional[str] = None
    content_base64: Optional[str] = None
    extension: Optional[str] = None
    parameters: Optional[dict] = None


def _active_enterprise_project(project_id: str | None = None) -> dict:
    frontend_local_projects_only()


@router.get("/platform")
def platform():
    return {
        "title": "Drake AI Enterprise Platform",
        "actions": ["Create New Project", "Open Existing Project"],
        "storage": project_locations(),
        "current_project": None,
        "project_storage_mode": "frontend_file_system_access_api",
    }


@router.get("/locations")
def project_locations():
    return {
        "locations": ["Desktop", "Documents", "C Drive", "D Drive", "Custom Folder"],
        "project_types": sorted(project_service.PROJECT_TYPES),
        "default_root": str(project_service.default_root()),
    }


@router.get("/registry")
def enterprise_project_registry(location_key: Optional[str] = None, custom_folder: Optional[str] = None):
    frontend_local_projects_only()


@router.post("/create")
def create_enterprise_project(req: EnterpriseProjectCreate):
    frontend_local_projects_only()


@router.post("/open")
def open_enterprise_project(req: EnterpriseProjectOpen):
    frontend_local_projects_only()


@router.get("/current")
def current_enterprise_project():
    frontend_local_projects_only()


@router.post("/upload")
async def upload_project_files(project_id: Optional[str] = Form(None), files: list[UploadFile] = File(...)):
    frontend_local_projects_only()


@router.get("/files")
def list_project_files(project_id: Optional[str] = None, module_name: Optional[str] = None):
    frontend_local_projects_only()


@router.get("/files/{file_id}/download")
def download_project_file(file_id: str, project_id: Optional[str] = None):
    frontend_local_projects_only()


@router.get("/results")
def list_project_results(project_id: Optional[str] = None):
    frontend_local_projects_only()


@router.get("/history")
def list_project_history(project_id: Optional[str] = None):
    frontend_local_projects_only()


@router.post("/save-result")
def save_project_result(req: SaveResultRequest):
    frontend_local_projects_only()


@router.post("/save-export")
def save_project_export(req: SaveExportRequest):
    frontend_local_projects_only()


@router.post("/set-storage-path")
def set_storage_path(req: StoragePathRequest):
    frontend_local_projects_only()


@router.get("/", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    projects = db.query(Project).filter(Project.owner_id == current_user.id).all()
    return [
        ProjectOut(
            id=p.id, name=p.name, description=p.description,
            field_name=p.field_name, basin=p.basin,
            country=p.country, operator=p.operator,
            well_count=len(p.wells),
        )
        for p in projects
    ]


@router.post("/", status_code=201, response_model=ProjectOut)
def create_project(
    req: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = Project(**req.dict(), owner_id=current_user.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return ProjectOut(id=p.id, name=p.name, description=p.description,
                      field_name=p.field_name, basin=p.basin,
                      country=p.country, operator=p.operator, well_count=0)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut(id=p.id, name=p.name, description=p.description,
                      field_name=p.field_name, basin=p.basin,
                      country=p.country, operator=p.operator, well_count=len(p.wells))


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()

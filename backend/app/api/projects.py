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
    current = project_service.get_current_project()
    if not current:
        raise HTTPException(status_code=404, detail="No active local Drake AI project. Create or open a project first.")
    if project_id and current.get("project_id") != project_id:
        matches = [item for item in project_service.list_projects() if item.get("project_id") == project_id]
        if not matches:
            raise HTTPException(status_code=404, detail="Project not found")
        current = project_service.open_project(matches[0]["project_path"])
    return current


@router.get("/platform")
def platform():
    return {
        "title": "Drake AI Enterprise Platform",
        "actions": ["Create New Project", "Open Existing Project"],
        "storage": project_locations(),
        "current_project": project_service.get_current_project(),
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
    return {"projects": project_service.list_projects(location_key, custom_folder)}


@router.post("/create")
def create_enterprise_project(req: EnterpriseProjectCreate):
    try:
        return project_service.create_project(
            project_name=req.project_name,
            description=req.description,
            project_type=req.project_type,
            storage_location=req.storage_location,
            custom_folder=req.custom_folder,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/open")
def open_enterprise_project(req: EnterpriseProjectOpen):
    try:
        return project_service.open_project(req.project_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/current")
def current_enterprise_project():
    project = project_service.get_current_project()
    if not project:
        raise HTTPException(status_code=404, detail="No active local Drake AI project.")
    return project


@router.post("/upload")
async def upload_project_files(project_id: Optional[str] = Form(None), files: list[UploadFile] = File(...)):
    project = _active_enterprise_project(project_id)
    records = []
    for upload in files:
        records.append(await copy_upload(project["project_path"], upload))
    return {"project": project_service.open_project(project["project_path"]), "files": records}


@router.get("/files")
def list_project_files(project_id: Optional[str] = None, module_name: Optional[str] = None):
    project = _active_enterprise_project(project_id)
    files = project.get("uploaded_files", [])
    if module_name:
        lower = module_name.lower()
        files = [item for item in files if any(lower in str(tag).lower() for tag in item.get("compatibility", []))]
    return {"project_id": project["project_id"], "files": files}


@router.get("/files/{file_id}/download")
def download_project_file(file_id: str, project_id: Optional[str] = None):
    project = _active_enterprise_project(project_id)
    try:
        record = find_file(project, file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project file not found")
    path = Path(record["project_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project file missing on disk")
    return FileResponse(path, filename=record.get("file_name") or path.name)


@router.get("/results")
def list_project_results(project_id: Optional[str] = None):
    project = _active_enterprise_project(project_id)
    return {"project_id": project["project_id"], "results": project.get("generated_results", [])}


@router.get("/history")
def list_project_history(project_id: Optional[str] = None):
    project = _active_enterprise_project(project_id)
    return {"project_id": project["project_id"], "history": project.get("module_history", [])}


@router.post("/save-result")
def save_project_result(req: SaveResultRequest):
    project = _active_enterprise_project(req.project_id)
    record = save_result(
        project["project_path"],
        module_name=req.module_name,
        well_name=req.well_name,
        prediction_name=req.prediction_name,
        extension=req.extension,
        content=req.content,
        content_base64=req.content_base64,
        result_payload=req.result_payload,
        parameters=req.parameters,
    )
    return {"project": project_service.open_project(project["project_path"]), "result": record}


@router.post("/save-export")
def save_project_export(req: SaveExportRequest):
    project = _active_enterprise_project(req.project_id)
    try:
        record = save_export(
            project["project_path"],
            module_name=req.module_name,
            source_file=req.source_file,
            export_type=req.export_type,
            well_name=req.well_name,
            prediction_name=req.prediction_name,
            content=req.content,
            content_base64=req.content_base64,
            extension=req.extension,
            parameters=req.parameters,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"project": project_service.open_project(project["project_path"]), "export": record}


@router.post("/set-storage-path")
def set_storage_path(req: StoragePathRequest):
    try:
        root = project_service.location_root(req.storage_location, req.custom_folder)
        root.mkdir(parents=True, exist_ok=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"storage_location": req.storage_location, "root": str(root)}


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

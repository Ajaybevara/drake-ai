from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Project, User

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

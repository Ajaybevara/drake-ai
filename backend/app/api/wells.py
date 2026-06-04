from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Well, FormationTop, User

router = APIRouter()


class WellCreate(BaseModel):
    project_id: int
    name: str
    api_number: Optional[str] = None
    operator: Optional[str] = None
    field: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    kb_elevation: Optional[float] = None
    total_depth: Optional[float] = None
    top_depth: Optional[float] = None
    base_depth: Optional[float] = None
    depth_uom: str = "ft"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str = "Active"
    uwi: Optional[str] = None


class FormationTopOut(BaseModel):
    id: int
    formation_name: str
    tvd_ft: Optional[float]
    md_ft: Optional[float]
    is_ai_detected: bool
    confidence: Optional[float]
    color_hex: str

    class Config:
        from_attributes = True


class WellOut(BaseModel):
    id: int
    project_id: int
    name: str
    api_number: Optional[str]
    operator: Optional[str]
    field: Optional[str]
    county: Optional[str]
    state: Optional[str]
    kb_elevation: Optional[float]
    total_depth: Optional[float]
    top_depth: Optional[float]
    base_depth: Optional[float]
    depth_uom: str
    status: str
    curve_count: int = 0
    file_count: int = 0
    formation_tops: List[FormationTopOut] = []

    class Config:
        from_attributes = True


@router.get("/project/{project_id}", response_model=List[WellOut])
def list_wells(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    wells = db.query(Well).filter(Well.project_id == project_id).all()
    return [
        WellOut(
            id=w.id, project_id=w.project_id, name=w.name,
            api_number=w.api_number, operator=w.operator, field=w.field,
            county=w.county, state=w.state, kb_elevation=w.kb_elevation,
            total_depth=w.total_depth, top_depth=w.top_depth,
            base_depth=w.base_depth, depth_uom=w.depth_uom, status=w.status,
            curve_count=len(w.curves), file_count=len(w.files),
            formation_tops=[
                FormationTopOut(
                    id=t.id, formation_name=t.formation_name,
                    tvd_ft=t.tvd_ft, md_ft=t.md_ft,
                    is_ai_detected=t.is_ai_detected,
                    confidence=t.confidence, color_hex=t.color_hex,
                )
                for t in w.formation_tops
            ],
        )
        for w in wells
    ]


@router.post("/", status_code=201, response_model=WellOut)
def create_well(req: WellCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    w = Well(**req.dict())
    db.add(w)
    db.commit()
    db.refresh(w)
    return WellOut(
        id=w.id, project_id=w.project_id, name=w.name,
        api_number=w.api_number, operator=w.operator, field=w.field,
        county=w.county, state=w.state, kb_elevation=w.kb_elevation,
        total_depth=w.total_depth, top_depth=w.top_depth,
        base_depth=w.base_depth, depth_uom=w.depth_uom, status=w.status,
    )


@router.get("/{well_id}", response_model=WellOut)
def get_well(well_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    w = db.query(Well).filter(Well.id == well_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Well not found")
    return WellOut(
        id=w.id, project_id=w.project_id, name=w.name,
        api_number=w.api_number, operator=w.operator, field=w.field,
        county=w.county, state=w.state, kb_elevation=w.kb_elevation,
        total_depth=w.total_depth, top_depth=w.top_depth,
        base_depth=w.base_depth, depth_uom=w.depth_uom, status=w.status,
        curve_count=len(w.curves), file_count=len(w.files),
        formation_tops=[
            FormationTopOut(
                id=t.id, formation_name=t.formation_name,
                tvd_ft=t.tvd_ft, md_ft=t.md_ft,
                is_ai_detected=t.is_ai_detected,
                confidence=t.confidence, color_hex=t.color_hex,
            )
            for t in w.formation_tops
        ],
    )


@router.delete("/{well_id}", status_code=204)
def delete_well(well_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    w = db.query(Well).filter(Well.id == well_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Well not found")
    db.delete(w)
    db.commit()

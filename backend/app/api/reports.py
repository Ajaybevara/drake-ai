"""Reports API — PDF/LAS export"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter()


@router.get("/well/{well_id}")
def list_reports(well_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return []


@router.post("/generate")
def generate_report(well_id: int, report_type: str = "petrophysics", db: Session = Depends(get_db), _=Depends(get_current_user)):
    return {"message": f"Report generation queued for well {well_id}", "type": report_type}

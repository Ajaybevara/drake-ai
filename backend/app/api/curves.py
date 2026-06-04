"""Curves API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Curve

router = APIRouter()


class CurveOut(BaseModel):
    id: int
    well_id: int
    mnemonic: str
    unit: Optional[str]
    description: Optional[str]
    min_value: Optional[float]
    max_value: Optional[float]
    mean_value: Optional[float]
    null_count: int
    is_predicted: bool

    class Config:
        from_attributes = True


class CurveDataOut(CurveOut):
    data: Optional[dict]


@router.get("/well/{well_id}", response_model=List[CurveOut])
def list_curves(well_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    curves = db.query(Curve).filter(Curve.well_id == well_id).all()
    return [
        CurveOut(
            id=c.id, well_id=c.well_id, mnemonic=c.mnemonic,
            unit=c.unit, description=c.description,
            min_value=c.min_value, max_value=c.max_value,
            mean_value=c.mean_value, null_count=c.null_count or 0,
            is_predicted=c.is_predicted,
        )
        for c in curves
    ]


@router.get("/{curve_id}/data", response_model=CurveDataOut)
def get_curve_data(curve_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Curve).filter(Curve.id == curve_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Curve not found")
    return CurveDataOut(
        id=c.id, well_id=c.well_id, mnemonic=c.mnemonic,
        unit=c.unit, description=c.description,
        min_value=c.min_value, max_value=c.max_value,
        mean_value=c.mean_value, null_count=c.null_count or 0,
        is_predicted=c.is_predicted, data=c.data,
    )


@router.get("/well/{well_id}/mnemonic/{mnemonic}", response_model=CurveDataOut)
def get_curve_by_mnemonic(well_id: int, mnemonic: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Curve).filter(Curve.well_id == well_id, Curve.mnemonic == mnemonic.upper()).first()
    if not c:
        raise HTTPException(status_code=404, detail=f"Curve {mnemonic} not found")
    return CurveDataOut(
        id=c.id, well_id=c.well_id, mnemonic=c.mnemonic,
        unit=c.unit, description=c.description,
        min_value=c.min_value, max_value=c.max_value,
        mean_value=c.mean_value, null_count=c.null_count or 0,
        is_predicted=c.is_predicted, data=c.data,
    )

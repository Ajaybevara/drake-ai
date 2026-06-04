"""AI Jobs API — runs petrophysics ML modules"""
import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user
from app.models import AIJob, Well, Curve, User, JobStatus, JobType

router = APIRouter()


class JobCreate(BaseModel):
    well_id: int
    job_type: JobType
    parameters: Optional[dict] = {}


class JobOut(BaseModel):
    id: int
    well_id: int
    job_type: str
    status: str
    progress: float
    accuracy: Optional[float]
    confidence: Optional[str]
    model_name: str
    predicted_curves: List[str] = []
    result: Optional[dict]
    error_message: Optional[str]
    created_at: Optional[str]
    completed_at: Optional[str]

    class Config:
        from_attributes = True


def run_job_thread(job_id: int):
    """Run AI job in a background thread"""
    db = SessionLocal()
    try:
        job = db.query(AIJob).filter(AIJob.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.running
        job.started_at = datetime.utcnow()
        job.progress = 0.0
        db.commit()

        well = db.query(Well).filter(Well.id == job.well_id).first()
        curves = db.query(Curve).filter(Curve.well_id == job.well_id).all()

        # Import the appropriate ML service
        from app.ml.petrophysics import run_ml_job
        result = run_ml_job(job.job_type, well, curves, job.parameters, db, job)

        job.status = JobStatus.completed
        job.progress = 100.0
        job.completed_at = datetime.utcnow()
        job.accuracy = result.get("accuracy")
        job.confidence = result.get("confidence", "High")
        job.predicted_curves = result.get("predicted_curves", [])
        job.result = result
        db.commit()

    except Exception as e:
        db = SessionLocal()
        job = db.query(AIJob).filter(AIJob.id == job_id).first()
        if job:
            job.status = JobStatus.failed
            job.error_message = str(e)
            job.progress = 0.0
            db.commit()
    finally:
        db.close()


@router.post("/run", response_model=JobOut, status_code=201)
def create_job(
    req: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    well = db.query(Well).filter(Well.id == req.well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail="Well not found")

    job = AIJob(
        well_id=req.well_id,
        job_type=req.job_type,
        status=JobStatus.pending,
        created_by=current_user.id,
        parameters=req.parameters or {},
        model_name="Drake AI-ML v2.3",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Start background thread
    t = threading.Thread(target=run_job_thread, args=(job.id,), daemon=True)
    t.start()

    return _job_to_out(job)


@router.get("/well/{well_id}", response_model=List[JobOut])
def list_jobs(well_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    jobs = db.query(AIJob).filter(AIJob.well_id == well_id).order_by(AIJob.created_at.desc()).all()
    return [_job_to_out(j) for j in jobs]


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    job = db.query(AIJob).filter(AIJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_out(job)


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    job = db.query(AIJob).filter(AIJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()


def _job_to_out(j: AIJob) -> JobOut:
    return JobOut(
        id=j.id,
        well_id=j.well_id,
        job_type=j.job_type,
        status=j.status,
        progress=j.progress or 0.0,
        accuracy=j.accuracy,
        confidence=j.confidence,
        model_name=j.model_name,
        predicted_curves=j.predicted_curves or [],
        result=j.result,
        error_message=j.error_message,
        created_at=j.created_at.isoformat() if j.created_at else None,
        completed_at=j.completed_at.isoformat() if j.completed_at else None,
    )

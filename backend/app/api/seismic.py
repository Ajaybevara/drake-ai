"""Seismic module API routes."""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4
import shutil

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.ml.seismic_enhancer import (
    SeismicEnhancementConfig,
    inspect_seismic_file,
    run_low_frequency_enhancement,
)

router = APIRouter()

SEISMIC_UPLOAD_DIR = Path("uploads") / "seismic"
SUPPORTED_EXTENSIONS = {".sgy", ".segy", ".npy", ".csv", ".txt"}


class SeismicEnhancementRequest(BaseModel):
    file_name: str
    storage_path: str | None = None
    freq_low: float = Field(default=0.0, ge=0.0)
    freq_high: float = Field(default=8.0, gt=0.0)
    gain: float = Field(default=1.8, ge=1.0, le=10.0)
    sample_interval_ms: float = Field(default=2.0, gt=0.0)
    workflow: str = Field(default="Both")
    dimension: str = Field(default="3D")
    dl_epochs: int = Field(default=15, ge=1, le=100)
    dl_batch: int = Field(default=32, ge=1, le=512)


@router.post("/files/upload")
async def upload_seismic_file(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Upload a .sgy, .segy, .npy, .csv, or .txt seismic file.")

    SEISMIC_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid4().hex}{suffix}"
    target = SEISMIC_UPLOAD_DIR / safe_name
    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "file_name": file.filename,
        "storage_path": str(target),
        "status": "uploaded",
        "compatibility": ["Seismic"],
    }


@router.post("/inspect")
def inspect_seismic(payload: SeismicEnhancementRequest):
    try:
        return inspect_seismic_file(payload.file_name, payload.storage_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to inspect seismic file: {exc}") from exc


@router.post("/low-frequency-enhancement")
def low_frequency_enhancement(payload: SeismicEnhancementRequest):
    if payload.freq_high <= payload.freq_low:
        raise HTTPException(status_code=400, detail="freq_high must be greater than freq_low.")
    try:
        return run_low_frequency_enhancement(
            SeismicEnhancementConfig(
                file_name=payload.file_name,
                storage_path=payload.storage_path,
                freq_low=payload.freq_low,
                freq_high=payload.freq_high,
                gain=payload.gain,
                sample_interval_ms=payload.sample_interval_ms,
                workflow=payload.workflow,
                dimension=payload.dimension,
                dl_epochs=payload.dl_epochs,
                dl_batch=payload.dl_batch,
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Seismic enhancement failed: {exc}") from exc

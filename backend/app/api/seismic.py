from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel, Field
from pathlib import Path

from app.ml.seismic_enhancer import run_low_frequency_enhancement

router = APIRouter()


class SeismicEnhancementRequest(BaseModel):
    file_name: str = "project-seismic.sgy"
    storage_path: str | None = None
    freq_low: float = Field(default=0.0, ge=0.0)
    freq_high: float = Field(default=10.0, gt=0.0)
    gain: float = Field(default=1.65, gt=0.0)
    sample_interval_ms: float = Field(default=2.0, gt=0.0)


@router.post("/low-frequency-enhancement")
async def low_frequency_enhancement(payload: SeismicEnhancementRequest):
    file_bytes = None
    if payload.storage_path:
        path = Path(payload.storage_path)
        if path.exists() and path.is_file():
            file_bytes = path.read_bytes()
    return run_low_frequency_enhancement(
        file_name=payload.file_name,
        file_bytes=file_bytes,
        freq_low=payload.freq_low,
        freq_high=payload.freq_high,
        gain=payload.gain,
        sample_interval_ms=payload.sample_interval_ms,
    )


@router.post("/low-frequency-enhancement/upload")
async def low_frequency_enhancement_upload(
    file: UploadFile = File(...),
    freq_low: float = 0.0,
    freq_high: float = 10.0,
    gain: float = 1.65,
    sample_interval_ms: float = 2.0,
):
    content = await file.read()
    return run_low_frequency_enhancement(
        file_name=file.filename or "uploaded-seismic.sgy",
        file_bytes=content,
        freq_low=freq_low,
        freq_high=freq_high,
        gain=gain,
        sample_interval_ms=sample_interval_ms,
    )

from pathlib import Path
import shutil
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .core import (
    build_calculation_response,
    make_sample_las,
    session_from_las,
    write_zones_xlsx,
)

router = APIRouter(prefix="/api/ccus", tags=["CCUS"])

CCUS_DIR = Path("uploads") / "ccus"
CCUS_UPLOAD_DIR = CCUS_DIR / "uploads"
CCUS_OUTPUT_DIR = CCUS_DIR / "outputs"
CCUS_SAMPLE_DIR = CCUS_DIR / "sample_data"
SESSIONS: dict[str, dict] = {}


def _ensure_dirs():
    for path in (CCUS_UPLOAD_DIR, CCUS_OUTPUT_DIR, CCUS_SAMPLE_DIR):
        path.mkdir(parents=True, exist_ok=True)


def _store_session(session: dict) -> dict:
    SESSIONS[session["id"]] = session
    return {
        "session_id": session["id"],
        "meta": session["meta"],
        "curves": session["curves"],
        "units": session["units"],
        "mapping": session["mapping"],
    }


@router.post("/load-sample")
def load_sample():
    _ensure_dirs()
    try:
        sample_path = make_sample_las(CCUS_SAMPLE_DIR)
        return _store_session(session_from_las(sample_path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Sample LAS load failed: {exc}") from exc


@router.post("/upload")
async def upload_las(file: UploadFile = File(...)):
    _ensure_dirs()
    if not file.filename or not file.filename.lower().endswith(".las"):
        raise HTTPException(status_code=400, detail="Please upload a valid .las file.")
    safe_name = Path(file.filename).name.replace(" ", "_")
    target = CCUS_UPLOAD_DIR / f"{uuid.uuid4().hex[:8]}_{safe_name}"
    with target.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    try:
        return _store_session(session_from_las(target, display_name=file.filename))
    except Exception as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"LAS read failed: {exc}") from exc


@router.post("/calculate")
def calculate(payload: dict):
    sid = payload.get("session_id")
    if not sid or sid not in SESSIONS:
        raise HTTPException(status_code=400, detail="Session expired. Upload or load a LAS file again.")
    try:
        result = build_calculation_response(SESSIONS[sid], payload)
        SESSIONS[sid]["last"] = {
            "calculated": result["calculated"],
            "zones": result["zones"],
            "summary": result["summary"],
            "params": result["params"],
        }
        public_result = dict(result)
        public_result.pop("calculated", None)
        public_result.pop("params", None)
        public_result["export_url"] = f"/api/ccus/export/{sid}"
        return public_result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CCUS screening failed: {exc}") from exc


@router.get("/export/{session_id}")
def export(session_id: str):
    if session_id not in SESSIONS or not SESSIONS[session_id].get("last"):
        raise HTTPException(status_code=404, detail="No calculated CCUS results available.")
    _ensure_dirs()
    last = SESSIONS[session_id]["last"]
    output_path = CCUS_OUTPUT_DIR / f"preliminary_ccs_screening_{session_id[:8]}.xlsx"
    write_zones_xlsx(
        output_path,
        last["zones"],
        last["summary"],
        SESSIONS[session_id].get("meta", {}),
        last.get("calculated", []),
        last.get("params", {}),
    )
    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=output_path.name,
    )

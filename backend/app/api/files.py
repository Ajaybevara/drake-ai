"""File upload endpoint — parses LAS files and stores curves in DB"""
import os, shutil, json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Well, WellFile, Curve, User
from app.services.las_parser import parse_las_file

router = APIRouter()

UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {".las", ".dlis", ".lis", ".csv", ".xlsx", ".pdf", ".tif", ".tiff"}


def get_file_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    mapping = {
        ".las": "LAS", ".dlis": "DLIS", ".lis": "LIS",
        ".csv": "CSV", ".xlsx": "XLSX",
        ".pdf": "PDF", ".tif": "TIFF", ".tiff": "TIFF",
    }
    return mapping.get(ext, "UNKNOWN")


@router.post("/upload/{well_id}")
async def upload_file(
    well_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    well = db.query(Well).filter(Well.id == well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail="Well not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    # Save to disk
    well_dir = os.path.join(UPLOAD_DIR, str(well_id))
    os.makedirs(well_dir, exist_ok=True)
    safe_name = file.filename.replace(" ", "_")
    disk_path = os.path.join(well_dir, safe_name)

    with open(disk_path, "wb") as f:
        content = await file.read()
        f.write(content)

    file_size = len(content)
    file_type = get_file_type(file.filename)

    # Create DB record
    wf = WellFile(
        well_id=well_id,
        filename=safe_name,
        original_name=file.filename,
        file_type=file_type,
        file_size=file_size,
        storage_path=disk_path,
        is_processed=False,
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)

    # Parse LAS files automatically
    curves_added = []
    if file_type == "LAS":
        try:
            parsed = parse_las_file(disk_path)
            wf.depth_start = parsed.get("start")
            wf.depth_end = parsed.get("stop")
            wf.depth_step = parsed.get("step")
            wf.curve_count = len(parsed.get("curves", []))
            wf.is_processed = True
            wf.metadata_json = parsed.get("header", {})
            header = parsed.get("header", {}) or {}
            well.field = header.get("field") or well.field
            well.county = header.get("county") or well.county
            well.state = header.get("state") or well.state
            well.operator = header.get("company") or well.operator
            well.kb_elevation = header.get("kb") or well.kb_elevation
            well.top_depth = parsed.get("start") or well.top_depth
            well.base_depth = parsed.get("stop") or well.base_depth
            well.total_depth = parsed.get("stop") or well.total_depth
            if header.get("well_name") and well.name.startswith("New Study"):
                well.name = header.get("well_name")

            for curve_data in parsed.get("curves", []):
                existing = db.query(Curve).filter(
                    Curve.well_id == well_id,
                    Curve.mnemonic == curve_data["mnemonic"],
                    Curve.is_predicted == False,
                ).first()
                if existing:
                    existing.data = curve_data["data"]
                    existing.unit = curve_data.get("unit")
                    existing.min_value = curve_data.get("min_value")
                    existing.max_value = curve_data.get("max_value")
                    existing.mean_value = curve_data.get("mean_value")
                    existing.null_count = curve_data.get("null_count", 0)
                    existing.source_file_id = wf.id
                    curves_added.append(curve_data["mnemonic"])
                else:
                    c = Curve(
                        well_id=well_id,
                        mnemonic=curve_data["mnemonic"],
                        unit=curve_data.get("unit"),
                        description=curve_data.get("description"),
                        data=curve_data["data"],
                        min_value=curve_data.get("min_value"),
                        max_value=curve_data.get("max_value"),
                        mean_value=curve_data.get("mean_value"),
                        null_count=curve_data.get("null_count", 0),
                        source_file_id=wf.id,
                    )
                    db.add(c)
                    curves_added.append(curve_data["mnemonic"])

            db.commit()
        except Exception as e:
            wf.is_processed = False
            db.commit()
            return {
                "id": wf.id,
                "filename": wf.filename,
                "file_type": wf.file_type,
                "file_size": wf.file_size,
                "warning": f"LAS parse error: {str(e)}",
                "curves_added": [],
            }

    db.refresh(wf)
    return {
        "id": wf.id,
        "filename": wf.filename,
        "file_type": wf.file_type,
        "file_size": wf.file_size,
        "is_processed": wf.is_processed,
        "depth_start": wf.depth_start,
        "depth_end": wf.depth_end,
        "curve_count": wf.curve_count,
        "curves_added": curves_added,
    }


@router.get("/well/{well_id}")
def list_files(well_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    files = db.query(WellFile).filter(WellFile.well_id == well_id).all()
    return [
        {
            "id": f.id,
            "filename": f.original_name or f.filename,
            "file_type": f.file_type,
            "file_size_mb": round((f.file_size or 0) / 1024 / 1024, 1),
            "is_processed": f.is_processed,
            "curve_count": f.curve_count,
            "depth_start": f.depth_start,
            "depth_end": f.depth_end,
            "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
        }
        for f in files
    ]


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(WellFile).filter(WellFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.storage_path and os.path.exists(f.storage_path):
        os.remove(f.storage_path)
    db.delete(f)
    db.commit()

import io
import json
import time
import uuid
import zipfile
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.ml.geothermal import analyze_geothermal_las, dataframe_to_csv_bytes, heat_flow_map_png, result_to_json_bytes

router = APIRouter()

geothermal_store: dict[str, dict] = {}


def _store_result(filename: str, result: dict, df: pd.DataFrame) -> dict:
    session_id = str(uuid.uuid4())
    geothermal_store[session_id] = {"filename": filename, "result": result, "df": df, "created_at": time.time()}
    return {"session_id": session_id, "loaded": True, "result": result}


def _get_session(session_id: str) -> dict:
    session = geothermal_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Geothermal session not found. Upload or load a LAS again.")
    return session


def _zip_sample_bytes() -> tuple[str, bytes] | None:
    zip_path = Path.home() / "Downloads" / "Geothermal.zip"
    if not zip_path.exists():
        return None
    sample_names = [
        "Drake_AI_Geothermal_Fixed/uploads/Drake_AI_Geo_GBG-01H.las",
        "Drake_AI_Geothermal_Fixed/sample_geothermal_well.las",
        "Drake_AI_Geothermal_Fixed/uploads/sample_geothermal_well.las",
    ]
    with zipfile.ZipFile(zip_path, "r") as archive:
        normalized = {name.replace("\\", "/"): name for name in archive.namelist()}
        for sample in sample_names:
            if sample in normalized:
                return Path(sample).name, archive.read(normalized[sample])
    return None


@router.post("/upload")
async def upload_geothermal_las(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".las"):
        raise HTTPException(status_code=400, detail="Please upload a valid LAS file.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded LAS file is empty.")
    try:
        result, df = analyze_geothermal_las(file.filename, content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Geothermal LAS analysis failed: {exc}")
    return _store_result(file.filename, result, df)


@router.post("/sample")
def load_geothermal_sample():
    sample = _zip_sample_bytes()
    if sample is None:
        raise HTTPException(status_code=404, detail="No Geothermal.zip sample LAS was found in Downloads.")
    filename, content = sample
    try:
        result, df = analyze_geothermal_las(filename, content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Geothermal sample analysis failed: {exc}")
    return _store_result(filename, result, df)


@router.get("/export/{session_id}/results.csv")
def export_geothermal_csv(session_id: str):
    session = _get_session(session_id)
    return Response(
        dataframe_to_csv_bytes(session["df"]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{Path(session["filename"]).stem}_geothermal_results.csv"'},
    )


@router.get("/export/{session_id}/interpretation.json")
def export_geothermal_json(session_id: str):
    session = _get_session(session_id)
    return Response(
        result_to_json_bytes(session["result"]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{Path(session["filename"]).stem}_geothermal_interpretation.json"'},
    )


@router.get("/export/{session_id}/{section}.{fmt}")
def export_geothermal_section(session_id: str, section: str, fmt: str):
    session = _get_session(session_id)
    if fmt not in {"csv", "json"}:
        raise HTTPException(status_code=400, detail="Use csv or json.")
    data = session["result"].get("sections", {}).get(section)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Unknown section: {section}")
    if fmt == "json":
        payload = json.dumps(data, indent=2).encode("utf-8")
        media_type = "application/json"
    else:
        payload = pd.DataFrame(data).to_csv(index=False).encode("utf-8")
        media_type = "text/csv"
    return Response(
        payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{section}.{fmt}"'},
    )


@router.get("/heat-flow-map/{session_id}.png")
def geothermal_heat_flow_map(session_id: str):
    session = _get_session(session_id)
    try:
        png = heat_flow_map_png(session["result"], session["df"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Heat-flow map failed: {exc}")
    return Response(png, media_type="image/png")

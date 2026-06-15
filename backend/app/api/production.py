from fastapi import APIRouter, File, UploadFile, HTTPException
import io
import pandas as pd

from app.ml.production_intelligence import analyze_production, make_sample_data

router = APIRouter()


@router.get("/sample")
def production_sample():
    return analyze_production(make_sample_data())


@router.post("/analyze")
async def production_analyze(file: UploadFile | None = File(None)):
    if file is None:
        return analyze_production(make_sample_data())
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded production file is empty.")
    try:
        if file.filename.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(raw))
        else:
            df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse production file: {exc}")
    return analyze_production(df)

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Well, Curve
from app.ml.drake_uncertainty import build_prediction_bundle, compute_uncertainty_analysis
from pydantic import BaseModel
from typing import Optional
import os
import re
import tempfile
import uuid

import lasio
import numpy as np
import pandas as pd

router = APIRouter()

crossplot_las_store: dict[str, pd.DataFrame] = {}


class CrossPlotRequest(BaseModel):
    session_id: str
    x_curve: str
    y_curve: str
    color_by: Optional[str] = "Depth"
    x_scale: Optional[str] = "Linear"
    y_scale: Optional[str] = "Linear"
    x_min: Optional[float] = None
    x_max: Optional[float] = None
    y_min: Optional[float] = None
    y_max: Optional[float] = None


def _safe_float(value):
    if value is None:
        return None
    if isinstance(value, (int, np.integer)):
        return float(value)
    if isinstance(value, (float, np.floating)):
        if np.isnan(value) or np.isinf(value) or abs(value + 999.25) < 1e-6:
            return None
        return float(value)
    if isinstance(value, bytes):
        value = value.decode(errors="ignore")
    if isinstance(value, str):
        match = re.search(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", value.strip())
        if not match:
            return None
        try:
            parsed = float(match.group(0))
        except ValueError:
            return None
        if np.isnan(parsed) or np.isinf(parsed) or abs(parsed + 999.25) < 1e-6:
            return None
        return parsed
    try:
        parsed = float(value)
    except Exception:
        return None
    if np.isnan(parsed) or np.isinf(parsed) or abs(parsed + 999.25) < 1e-6:
        return None
    return parsed


def _sanitize_list(values):
    return [_safe_float(value) for value in values]


def _parse_las_data_section(file_path: str, expected_columns: list[str]):
    with open(file_path, "r", errors="replace") as handle:
        lines = handle.read().splitlines()

    start = None
    for index, line in enumerate(lines):
        marker = line.strip().upper()
        if marker.startswith("~A") or marker.startswith("~ASCII") or marker.startswith("~OTHER"):
            start = index + 1
            break

    if start is None:
        return None

    rows = []
    tokens: list[str] = []
    header = None
    expected_len = len(expected_columns)
    for line in lines[start:]:
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", ";", "!", "*")):
            continue
        parts = re.split(r"\s+", stripped)
        if header is None and any(re.search(r"[A-Za-z]", part) for part in parts):
            if len(parts) >= 2:
                header = [part.upper() for part in parts]
                continue
        tokens.extend(parts)
        while len(tokens) >= expected_len:
            rows.append(tokens[:expected_len])
            tokens = tokens[expected_len:]

    if not rows:
        return None

    columns = header if header and len(header) == expected_len else expected_columns
    df = pd.DataFrame(rows, columns=columns)
    depth_names = {expected_columns[0].upper(), "DEPTH", "DEPT", "MD"}
    for col in df.columns:
        if col.upper() in depth_names:
            df.set_index(col, inplace=True)
            break
    return df


def _curve_stats(values, curve_name: str):
    arr = np.asarray(values, dtype=float)
    arr = arr[np.isfinite(arr)]
    if len(arr) == 0:
        return {"curve": curve_name, "count": 0, "min": None, "max": None, "mean": None, "std": None}
    return {
        "curve": curve_name,
        "count": int(len(arr)),
        "min": _safe_float(np.nanmin(arr)),
        "max": _safe_float(np.nanmax(arr)),
        "mean": _safe_float(np.nanmean(arr)),
        "std": _safe_float(np.nanstd(arr)),
        "p10": _safe_float(np.nanpercentile(arr, 10)),
        "p50": _safe_float(np.nanpercentile(arr, 50)),
        "p90": _safe_float(np.nanpercentile(arr, 90)),
    }


def _build_demo_las() -> str:
    depths = np.arange(1000.0, 1800.5, 0.5)
    rng = np.random.default_rng(42)
    gr = 72 + 28 * np.sin(depths / 45) + rng.normal(0, 6, len(depths))
    rhob = 2.42 + 0.13 * np.cos(depths / 82) + rng.normal(0, 0.025, len(depths))
    nphi = 0.22 + 0.07 * np.sin(depths / 63 + 0.7) + rng.normal(0, 0.015, len(depths))
    dt = 78 + 12 * np.cos(depths / 95) + rng.normal(0, 3, len(depths))
    rt = np.clip(18 + 35 * np.sin(depths / 110) + rng.normal(0, 7, len(depths)), 0.2, 150)
    rows = "\n".join(
        f"{d:.1f} {g:.3f} {r:.4f} {n:.4f} {t:.3f} {res:.3f}"
        for d, g, r, n, t, res in zip(depths, gr, rhob, nphi, dt, rt)
    )
    return f"""~Version
VERS. 2.0 : CWLS LOG ASCII STANDARD
WRAP. NO
~Well
STRT.FT 1000.0 : START DEPTH
STOP.FT 1800.0 : STOP DEPTH
STEP.FT 0.5 : STEP
NULL. -999.25 : NULL
COMP. Drake AI : COMPANY
WELL. CROSSPLOT_DEMO : WELL
FLD. Red Canyon : FIELD
CTRY. USA : COUNTRY
~Curve
DEPT.FT : Depth
GR.API : Gamma Ray
RHOB.G/C3 : Bulk Density
NPHI.V/V : Neutron Porosity
DT.US/F : Sonic
RT.OHMM : Resistivity
~ASCII
{rows}
"""


def _parse_crossplot_las(content: bytes, file_name: str):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".las", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        las = lasio.read(tmp_path)
        curves = []
        expected_columns = []
        for curve in las.curves:
            mnemonic = curve.mnemonic.upper()
            expected_columns.append(mnemonic)
            curves.append({
                "mnemonic": mnemonic,
                "unit": curve.unit or "",
                "description": curve.descr or "",
            })

        df = las.df()
        if df.empty:
            fallback = _parse_las_data_section(tmp_path, expected_columns)
            if fallback is None or fallback.empty:
                raise HTTPException(status_code=400, detail="Failed to parse LAS data section.")
            df = fallback

        df = df.apply(lambda col: col.map(_safe_float))
        df.reset_index(inplace=True)
        df.columns = [str(col).upper() for col in df.columns]
        depth_col = df.columns[0]
        df[depth_col] = pd.to_numeric(df[depth_col], errors="coerce")

        session_id = str(uuid.uuid4())
        crossplot_las_store[session_id] = df

        def well_value(name):
            try:
                value = getattr(las.well, name).value
                return value or ""
            except Exception:
                return ""

        return {
            "session_id": session_id,
            "file_name": file_name,
            "well_name": well_value("WELL"),
            "field": well_value("FLD"),
            "company": well_value("COMP"),
            "country": well_value("CTRY"),
            "num_curves": len(curves),
            "depth_min": _safe_float(df[depth_col].min()),
            "depth_max": _safe_float(df[depth_col].max()),
            "curves": curves,
            "curve_names": [curve["mnemonic"] for curve in curves if curve["mnemonic"] in df.columns],
            "depth_curve": depth_col,
            "rows": int(len(df)),
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _build_analysis_item(curves: list[Curve]) -> dict:
    log_names = []
    curve_rows = []
    depth_reference = None
    max_len = 0

    for curve in curves:
        data = curve.data or {}
        depths = data.get('depths')
        values = data.get('values')
        if not isinstance(values, list) or len(values) == 0:
            continue

        log_names.append(curve.mnemonic)
        max_len = max(max_len, len(values))
        curve_rows.append((curve.mnemonic, values))

        if depth_reference is None and isinstance(depths, list) and len(depths) == len(values):
            depth_reference = depths

    logs_data = []
    for idx in range(max_len):
        row = {
            'DEPTH': float(depth_reference[idx]) if depth_reference is not None and idx < len(depth_reference) else float(idx),
        }
        for mnemonic, values in curve_rows:
            row[mnemonic] = values[idx] if idx < len(values) else None
        logs_data.append(row)

    return {'log_names': log_names, 'logs_data': logs_data}


@router.post('/crossplot/load-demo')
def load_crossplot_demo():
    return _parse_crossplot_las(_build_demo_las().encode("utf-8"), "drake_crossplot_demo.las")


@router.post('/crossplot/upload-las')
async def upload_crossplot_las(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".las"):
        raise HTTPException(status_code=400, detail="Only LAS files are supported for petrophysics crossplot.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded LAS file is empty.")
    return _parse_crossplot_las(content, file.filename)


@router.post('/crossplot/generate')
def generate_crossplot(request: CrossPlotRequest):
    df = crossplot_las_store.get(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Crossplot LAS session not found. Upload or load a LAS file again.")
    if request.x_curve not in df.columns:
        raise HTTPException(status_code=400, detail=f"Curve '{request.x_curve}' not found.")
    if request.y_curve not in df.columns:
        raise HTTPException(status_code=400, detail=f"Curve '{request.y_curve}' not found.")

    depth_col = df.columns[0]
    plot_df = df[[depth_col, request.x_curve, request.y_curve]].copy()
    plot_df[depth_col] = pd.to_numeric(plot_df[depth_col], errors="coerce")
    plot_df[request.x_curve] = pd.to_numeric(plot_df[request.x_curve], errors="coerce")
    plot_df[request.y_curve] = pd.to_numeric(plot_df[request.y_curve], errors="coerce")

    color_name = request.color_by or "Depth"
    if color_name != "Depth" and color_name in df.columns:
        plot_df["_COLOR"] = pd.to_numeric(df[color_name], errors="coerce")
    else:
        color_name = "Depth"
        plot_df["_COLOR"] = plot_df[depth_col]

    plot_df = plot_df.dropna(subset=[depth_col, request.x_curve, request.y_curve])
    if plot_df.empty:
        raise HTTPException(status_code=400, detail="No valid numeric data points found for the selected curves.")

    x_vals = plot_df[request.x_curve].astype(float).to_numpy()
    y_vals = plot_df[request.y_curve].astype(float).to_numpy()
    depth_vals = plot_df[depth_col].astype(float).to_numpy()
    color_vals = plot_df["_COLOR"].astype(float).to_numpy()

    try:
        correlation = _safe_float(np.corrcoef(x_vals, y_vals)[0, 1])
    except Exception:
        correlation = None

    hover_text = [
        f"Depth: {depth:.2f}<br>{request.x_curve}: {x:.5g}<br>{request.y_curve}: {y:.5g}<br>{color_name}: {color:.5g}"
        for depth, x, y, color in zip(depth_vals, x_vals, y_vals, color_vals)
    ]

    plot_data = {
        "x": _sanitize_list(x_vals.tolist()),
        "y": _sanitize_list(y_vals.tolist()),
        "depth": _sanitize_list(depth_vals.tolist()),
        "color": _sanitize_list(color_vals.tolist()),
        "hover": hover_text,
        "x_curve": request.x_curve,
        "y_curve": request.y_curve,
        "color_by": color_name,
        "point_count": int(len(x_vals)),
        "statistics": {
            "x": _curve_stats(x_vals, request.x_curve),
            "y": _curve_stats(y_vals, request.y_curve),
            "correlation": correlation,
        },
    }

    figure = {
        "data": [{
            "type": "scattergl",
            "mode": "markers",
            "x": plot_data["x"],
            "y": plot_data["y"],
            "text": hover_text,
            "marker": {
                "size": 8,
                "opacity": 0.82,
                "color": plot_data["color"],
                "colorscale": "Turbo",
                "showscale": True,
                "colorbar": {"title": color_name},
            },
            "hovertemplate": "%{text}<extra></extra>",
        }],
        "layout": {
            "title": f"{request.x_curve} vs {request.y_curve}",
            "xaxis": {"title": request.x_curve, "type": "log" if request.x_scale == "Logarithmic" else "linear"},
            "yaxis": {"title": request.y_curve, "type": "log" if request.y_scale == "Logarithmic" else "linear"},
            "hovermode": "closest",
        },
    }

    return {**plot_data, "figure": figure}


@router.get('/well/{well_id}/prediction-bundle')
def get_prediction_bundle(well_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    well = db.query(Well).filter(Well.id == well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail='Well not found')

    curves = db.query(Curve).filter(Curve.well_id == well_id).all()
    if not curves:
        return {'success': False, 'message': 'No curve data available for this well.', 'bundle': {'porosity': [], 'saturation': [], 'lithology': [], 'preview': []}}

    item = _build_analysis_item(curves)
    uncertainty = compute_uncertainty_analysis(item, {'phi_method': 'percent', 'sw_method': 'percent'})
    if uncertainty.get('success'):
        records = uncertainty.get('all_records', [])
        bundle = {
            'porosity': [
                {
                    'DEPTH': row.get('DEPTH'),
                    'POROSITY': row.get('PHIE'),
                    'PHIT': row.get('PHIT'),
                    'VSH': row.get('VSH'),
                    'P10': row.get('PHI_P10'),
                    'P50': row.get('PHI_P50'),
                    'P90': row.get('PHI_P90'),
                    'CONFIDENCE': max(50, min(99, 100 - ((row.get('PHI_UNCERTAINTY_SPREAD') or 0) * 250))),
                }
                for row in records
                if row.get('PHIE') is not None
            ],
            'saturation': [
                {
                    'DEPTH': row.get('DEPTH'),
                    'SW': round((row.get('SW') or 0) * 100, 2) if row.get('SW') is not None else None,
                    'P10': round((row.get('SW_P10') or 0) * 100, 2) if row.get('SW_P10') is not None else None,
                    'P50': round((row.get('SW_P50') or 0) * 100, 2) if row.get('SW_P50') is not None else None,
                    'P90': round((row.get('SW_P90') or 0) * 100, 2) if row.get('SW_P90') is not None else None,
                    'RELIABILITY': max(50, min(99, 100 - ((row.get('SW_UNCERTAINTY_SPREAD') or 0) * 180))),
                    'RISK': 'Low' if (row.get('SW_UNCERTAINTY_SPREAD') or 1) < 0.08 else 'Medium' if (row.get('SW_UNCERTAINTY_SPREAD') or 1) < 0.16 else 'High',
                }
                for row in records
                if row.get('SW') is not None
            ],
            'lithology': [
                {'DEPTH': row.get('DEPTH'), 'LITHOLOGY': row.get('LITHOLOGY'), 'CONFIDENCE': 90}
                for row in records
            ],
            'preview': [
                {
                    'DEPTH': row.get('DEPTH'),
                    'POROSITY': row.get('PHIE'),
                    'WATER_SATURATION': round((row.get('SW') or 0) * 100, 2) if row.get('SW') is not None else None,
                    'LITHOLOGY': row.get('LITHOLOGY'),
                    'P10': row.get('PHI_P10'),
                    'P50': row.get('PHI_P50'),
                    'P90': row.get('PHI_P90'),
                }
                for row in records[:1000]
            ],
        }
    else:
        bundle = build_prediction_bundle(item)

    return {
        'success': True,
        'well_id': well.id,
        'well_name': well.name,
        'bundle': bundle,
        'available_logs': item['log_names'],
    }


@router.post('/well/{well_id}/uncertainty')
def get_uncertainty_analysis(well_id: int, payload: dict | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    well = db.query(Well).filter(Well.id == well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail='Well not found')

    curves = db.query(Curve).filter(Curve.well_id == well_id).all()
    if not curves:
        return {
            'success': False,
            'message': 'No curve data available for this well.',
            'all_records': [],
            'summary_cards': {},
        }

    item = _build_analysis_item(curves)
    analysis = compute_uncertainty_analysis(item, payload or {})
    analysis.update({
        'well_id': well.id,
        'well_name': well.name,
        'available_logs': item['log_names'],
    })
    return analysis

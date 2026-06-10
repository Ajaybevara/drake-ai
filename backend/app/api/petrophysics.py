from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Well, Curve
from app.ml.drake_uncertainty import build_prediction_bundle, compute_uncertainty_analysis
from pydantic import BaseModel
from typing import Optional
import os
import io
import json
import re
import tempfile
import uuid
from pathlib import Path

import lasio
import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import gaussian_kde

router = APIRouter()

crossplot_las_store: dict[str, pd.DataFrame] = {}
histogram_las_store: dict[str, lasio.LASFile] = {}
petro_las_store: dict[str, dict] = {}
autosplice_store: dict[str, dict] = {}


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


class HistogramRequest(BaseModel):
    file_id: str
    curve_name: str
    scale_type: str = "Auto"
    custom_min: Optional[float] = None
    custom_max: Optional[float] = None
    depth_from: Optional[float] = None
    depth_to: Optional[float] = None
    bins: int = 30
    opacity: float = 0.75
    kde_enabled: bool = True
    show_mean: bool = True
    show_median: bool = True
    show_percentiles: bool = True


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


def _decode_las_bytes(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def _has_valid_ascii_data(las: lasio.LASFile) -> bool:
    try:
        return len(las.index) > 0 and len(las.curves) > 1
    except Exception:
        return False


def _repair_legacy_las_ascii_section(text: str) -> str:
    lines = text.splitlines()
    numeric_start = None
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("~"):
            continue
        parts = stripped.split()
        if len(parts) < 2:
            continue
        try:
            [float(part) for part in parts]
            numeric_start = index
            break
        except ValueError:
            continue

    if numeric_start is None:
        return text

    section_index = None
    for index in range(numeric_start - 1, -1, -1):
        if lines[index].lstrip().startswith("~"):
            section_index = index
            break

    repaired = list(lines)
    if section_index is not None and repaired[section_index].strip().upper().startswith("~OTHER"):
        repaired[section_index] = "~ASCII LOG DATA"
        repaired = repaired[:section_index + 1] + repaired[numeric_start:]
    else:
        repaired = repaired[:numeric_start] + ["~ASCII LOG DATA"] + repaired[numeric_start:]
    return "\n".join(repaired) + "\n"


def _read_histogram_las(content: bytes) -> lasio.LASFile:
    text = _decode_las_bytes(content)
    las = lasio.read(io.StringIO(text), ignore_data=False)
    if _has_valid_ascii_data(las):
        return las
    repaired_text = _repair_legacy_las_ascii_section(text)
    if repaired_text != text:
        las = lasio.read(io.StringIO(repaired_text), ignore_data=False)
        if _has_valid_ascii_data(las):
            return las
    raise ValueError("No valid LAS data rows were found. Please check that the file contains an ASCII data section (~A/~ASCII) or a numeric depth table.")


def _histogram_metadata(las: lasio.LASFile, file_name: str, file_id: str):
    def get_header(key, default="N/A"):
        try:
            value = las.well[key].value
            return str(value) if value else default
        except Exception:
            return default

    curves = []
    for curve in las.curves:
        if curve.mnemonic.upper() not in ("DEPT", "DEPTH"):
            curves.append({
                "name": curve.mnemonic,
                "unit": curve.unit or "",
                "description": curve.descr or "",
            })

    depth_arr = np.asarray(las.index, dtype=float)
    if depth_arr.size == 0:
        raise ValueError("LAS file parsed successfully, but no depth samples were found")

    try:
        depth_step = abs(float(las.well["STEP"].value))
    except Exception:
        depth_step = round(abs(float(depth_arr[1] - depth_arr[0])), 4) if len(depth_arr) > 1 else 0.5

    try:
        null_value = float(las.well["NULL"].value)
    except Exception:
        null_value = -999.25

    return {
        "file_id": file_id,
        "file_name": file_name,
        "well_name": get_header("WELL"),
        "version": get_header("VERS"),
        "company": get_header("COMP"),
        "field": get_header("FLD"),
        "location": get_header("LOC"),
        "depth_start": float(np.nanmin(depth_arr)),
        "depth_stop": float(np.nanmax(depth_arr)),
        "depth_step": depth_step,
        "null_value": null_value,
        "num_curves": len(curves),
        "num_samples": int(len(depth_arr)),
        "curves": curves,
    }


def _las_header(las: lasio.LASFile, key: str, default: str = "N/A") -> str:
    try:
        value = las.well[key].value
        return str(value) if value not in (None, "") else default
    except Exception:
        return default


def _normalise_las_frame(las: lasio.LASFile) -> pd.DataFrame:
    df = las.df().reset_index()
    df.columns = [str(col).upper() for col in df.columns]
    depth_col = df.columns[0]
    if depth_col not in ("DEPTH", "DEPT", "MD"):
        df.rename(columns={depth_col: "DEPTH"}, inplace=True)
    else:
        df.rename(columns={depth_col: "DEPTH"}, inplace=True)
    for column in df.columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df.replace([-999.25, -9999.0, 999.25], np.nan, inplace=True)
    df.dropna(subset=["DEPTH"], inplace=True)
    df.sort_values("DEPTH", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def _petro_las_summary(las: lasio.LASFile, df: pd.DataFrame, file_name: str, session_id: str):
    curve_meta = []
    for curve in las.curves:
        name = str(curve.mnemonic).upper()
        if name in ("DEPT", "DEPTH", "MD"):
            continue
        if name in df.columns:
            curve_meta.append({
                "name": name,
                "unit": curve.unit or "",
                "description": curve.descr or "",
                "stats": _curve_stats(df[name].values, name),
            })

    depth = pd.to_numeric(df["DEPTH"], errors="coerce")
    return {
        "session_id": session_id,
        "file_name": file_name,
        "well_name": _las_header(las, "WELL", "Uploaded LAS Well"),
        "company": _las_header(las, "COMP"),
        "field": _las_header(las, "FLD"),
        "country": _las_header(las, "CTRY"),
        "depth_min": _safe_float(depth.min()),
        "depth_max": _safe_float(depth.max()),
        "depth_step": _safe_float(_las_header(las, "STEP", "0.5")),
        "rows": int(len(df)),
        "num_curves": len(curve_meta),
        "curve_names": [curve["name"] for curve in curve_meta],
        "curves": curve_meta,
    }


def _create_petro_las_session(content: bytes, file_name: str):
    try:
        las = _read_histogram_las(content)
        df = _normalise_las_frame(las)
        if df.empty or len(df.columns) < 2:
            raise ValueError("LAS file does not contain usable log curves.")
        session_id = str(uuid.uuid4())
        summary = _petro_las_summary(las, df, file_name, session_id)
        petro_las_store[session_id] = {"las": las, "df": df, "summary": summary}
        return summary
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse LAS file: {exc}")


def _get_petro_session(session_id: str) -> dict:
    session = petro_las_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="LAS session not found. Upload or load a LAS file again.")
    return session


def _analysis_item_from_df(df: pd.DataFrame) -> dict:
    sample = df.copy()
    max_rows = 30000
    if len(sample) > max_rows:
        sample = sample.iloc[np.linspace(0, len(sample) - 1, max_rows).astype(int)].copy()
    records = sample.where(pd.notna(sample), None).to_dict("records")
    return {"log_names": [col for col in sample.columns if col != "DEPTH"], "logs_data": records}


def _series_from_records(records: list[dict], key: str):
    return [row.get(key) for row in records if row.get("DEPTH") is not None and row.get(key) is not None]


def _depth_from_records(records: list[dict], key: str):
    return [row.get("DEPTH") for row in records if row.get("DEPTH") is not None and row.get(key) is not None]


def _uncertainty_figure(records: list[dict], kind: str, is_saturation: bool = False):
    prefix = "SW" if is_saturation else "PHI"
    title = "Saturation Uncertainty: P10 / P50 / P90" if is_saturation else "Porosity Uncertainty: P10 / P50 / P90"
    x_title = "Water Saturation Sw" if is_saturation else "MPVI (Porosity fraction)"
    color = "#B7791F" if is_saturation else "#0EA5E9"
    return {
        "data": [
            {
                "x": _series_from_records(records, f"{prefix}_P10"),
                "y": _depth_from_records(records, f"{prefix}_P10"),
                "type": "scatter",
                "mode": "lines",
                "name": "P10",
                "line": {"color": "#F97316", "width": 2, "dash": "dot"},
                "hovertemplate": f"Depth: %{{y:.2f}}<br>{prefix} P10: %{{x:.5f}}<extra></extra>",
            },
            {
                "x": _series_from_records(records, f"{prefix}_P50"),
                "y": _depth_from_records(records, f"{prefix}_P50"),
                "type": "scatter",
                "mode": "lines",
                "name": "P50",
                "line": {"color": "#2563EB", "width": 3},
                "hovertemplate": f"Depth: %{{y:.2f}}<br>{prefix} P50: %{{x:.5f}}<extra></extra>",
            },
            {
                "x": _series_from_records(records, f"{prefix}_P90"),
                "y": _depth_from_records(records, f"{prefix}_P90"),
                "type": "scatter",
                "mode": "lines",
                "name": "P90",
                "line": {"color": "#15803D", "width": 2, "dash": "dash"},
                "hovertemplate": f"Depth: %{{y:.2f}}<br>{prefix} P90: %{{x:.5f}}<extra></extra>",
            },
        ],
        "layout": {
            "title": {"text": title, "font": {"color": color, "size": 20}},
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "#F8FAFC",
            "xaxis": {"title": x_title, "gridcolor": "#E2E8F0", "zeroline": False},
            "yaxis": {"title": "Depth", "autorange": "reversed", "gridcolor": "#E2E8F0"},
            "legend": {"orientation": "h", "x": 0.45, "y": 0.02},
            "height": 640,
            "margin": {"l": 70, "r": 30, "t": 70, "b": 70},
            "hovermode": "closest",
        },
    }


def _build_log_viewer_figure(df: pd.DataFrame, curves: list[str] | None = None):
    available = [col for col in df.columns if col != "DEPTH"]
    selected = [curve.upper() for curve in (curves or []) if curve.upper() in available] or available[:5]
    colors = ["#FACC15", "#FB7185", "#93C5FD", "#3B82F6", "#FB923C", "#22C55E", "#A78BFA"]
    data = []
    for index, curve in enumerate(selected):
        data.append({
            "x": _sanitize_list(df[curve].values),
            "y": _sanitize_list(df["DEPTH"].values),
            "type": "scatter",
            "mode": "lines",
            "name": curve,
            "xaxis": f"x{index + 1}" if index else "x",
            "line": {"color": colors[index % len(colors)], "width": 2},
            "hovertemplate": f"Depth: %{{y:.2f}}<br>{curve}: %{{x:.4f}}<extra></extra>",
        })
    axis_width = 1 / max(len(selected), 1)
    layout = {
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "#06111F",
        "height": 680,
        "margin": {"l": 70, "r": 30, "t": 50, "b": 40},
        "showlegend": True,
        "hovermode": "closest",
        "yaxis": {"title": "Depth", "autorange": "reversed", "gridcolor": "#1E293B", "color": "#BBD7FF"},
    }
    for index, curve in enumerate(selected):
        key = "xaxis" if index == 0 else f"xaxis{index + 1}"
        layout[key] = {
            "title": curve,
            "domain": [index * axis_width + 0.01, (index + 1) * axis_width - 0.01],
            "anchor": "y",
            "side": "top",
            "gridcolor": "#1E293B",
            "color": "#BBD7FF",
        }
    return {"data": data, "layout": layout}


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


class PetroLogRequest(BaseModel):
    session_id: str
    curves: Optional[list[str]] = None
    depth_min: Optional[float] = None
    depth_max: Optional[float] = None


class PetroSessionRequest(BaseModel):
    session_id: str


def _filter_depth(df: pd.DataFrame, depth_min: Optional[float], depth_max: Optional[float]):
    filtered = df.copy()
    if depth_min is not None:
        filtered = filtered[filtered["DEPTH"] >= float(depth_min)]
    if depth_max is not None:
        filtered = filtered[filtered["DEPTH"] <= float(depth_max)]
    if len(filtered) > 6000:
        filtered = filtered.iloc[np.linspace(0, len(filtered) - 1, 6000).astype(int)].copy()
    return filtered


@router.post('/las/load-demo')
def load_petro_demo_las():
    return _create_petro_las_session(_build_demo_las().encode("utf-8"), "drake_petrophysics_demo.las")


@router.post('/las/upload')
async def upload_petro_las(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".las"):
        raise HTTPException(status_code=400, detail="Only LAS files are supported.")
    return _create_petro_las_session(await file.read(), file.filename)


@router.post('/las/log-viewer')
def generate_petro_log_viewer(request: PetroLogRequest):
    session = _get_petro_session(request.session_id)
    df = _filter_depth(session["df"], request.depth_min, request.depth_max)
    figure = _build_log_viewer_figure(df, request.curves)
    return {
        "summary": session["summary"],
        "selected_curves": request.curves or session["summary"]["curve_names"][:5],
        "figure": figure,
    }


@router.post('/las/prediction')
def generate_petro_prediction(request: PetroSessionRequest):
    session = _get_petro_session(request.session_id)
    item = _analysis_item_from_df(session["df"])
    bundle = build_prediction_bundle(item)
    uncertainty = compute_uncertainty_analysis(item, {"phi_method": "percent", "sw_method": "percent", "phi_pct": 0.12, "sw_pct": 0.15})
    records = uncertainty.get("all_records", []) if uncertainty.get("success") else []
    return {
        "summary": session["summary"],
        "bundle": bundle,
        "records": records[:5],
        "all_records": records,
        "summary_cards": uncertainty.get("summary_cards", {}),
        "figure": {
            "data": [
                {
                    "x": _series_from_records(records, "PHIE"),
                    "y": _depth_from_records(records, "PHIE"),
                    "type": "scatter",
                    "mode": "lines",
                    "name": "Effective Porosity",
                    "line": {"color": "#38BDF8", "width": 3},
                    "hovertemplate": "Depth: %{y:.2f}<br>PHIE: %{x:.5f}<extra></extra>",
                },
                {
                    "x": _series_from_records(records, "SW"),
                    "y": _depth_from_records(records, "SW"),
                    "type": "scatter",
                    "mode": "lines",
                    "name": "Water Saturation",
                    "line": {"color": "#F59E0B", "width": 3},
                    "xaxis": "x2",
                    "hovertemplate": "Depth: %{y:.2f}<br>SW: %{x:.5f}<extra></extra>",
                },
            ],
            "layout": {
                "paper_bgcolor": "rgba(0,0,0,0)",
                "plot_bgcolor": "#06111F",
                "height": 560,
                "margin": {"l": 70, "r": 40, "t": 40, "b": 50},
                "yaxis": {"title": "Depth", "autorange": "reversed", "gridcolor": "#1E293B", "color": "#BBD7FF"},
                "xaxis": {"title": "PHIE", "domain": [0, 0.47], "gridcolor": "#1E293B", "color": "#BBD7FF"},
                "xaxis2": {"title": "SW", "domain": [0.53, 1], "gridcolor": "#1E293B", "color": "#BBD7FF"},
                "legend": {"orientation": "h", "x": 0, "y": 1.08},
                "hovermode": "closest",
            },
        },
    }


@router.post('/las/uncertainty')
def generate_petro_uncertainty(request: dict):
    session_id = request.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")
    session = _get_petro_session(str(session_id))
    item = _analysis_item_from_df(session["df"])
    payload = {
        "phi_method": request.get("phi_method", "fixed"),
        "phi_unc": float(request.get("phi_unc", 0.03)),
        "phi_pct": float(request.get("phi_pct", 0.10)),
        "sw_method": request.get("sw_method", "fixed"),
        "sw_unc": float(request.get("sw_unc", 0.05)),
        "sw_pct": float(request.get("sw_pct", 0.10)),
    }
    analysis = compute_uncertainty_analysis(item, payload)
    if not analysis.get("success"):
        raise HTTPException(status_code=400, detail=analysis.get("message", "Uncertainty calculation failed."))
    records = analysis.get("all_records", [])
    return {
        "summary": session["summary"],
        "records": analysis.get("records", []),
        "all_records": records,
        "summary_cards": analysis.get("summary_cards", {}),
        "phi_interp": analysis.get("phi_interp", []),
        "sw_interp": analysis.get("sw_interp", []),
        "porosity_figure": _uncertainty_figure(records, "porosity"),
        "saturation_figure": _uncertainty_figure(records, "saturation", True),
    }


def _safe_filename(name: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "_", name or "upload.las").strip("._")
    return clean or "upload.las"


def _validate_autosplice_las(path: Path):
    try:
        with path.open("rb") as handle:
            las = _read_histogram_las(handle.read())
        df = _normalise_las_frame(las)
        curves = [col for col in df.columns if col != "DEPTH"]
        if df.empty or not curves:
            raise ValueError("No usable curves found.")
        return {
            "valid": True,
            "file_name": path.name,
            "well": _las_header(las, "WELL", path.stem),
            "rows": int(len(df)),
            "curve_count": len(curves),
            "curves": curves,
            "depth_min": _safe_float(df["DEPTH"].min()),
            "depth_max": _safe_float(df["DEPTH"].max()),
            "df": df,
            "las": las,
        }
    except Exception as exc:
        return {"valid": False, "file_name": path.name, "error": str(exc)}


def _write_spliced_las(records: list[dict], output_path: Path, step: float = 0.1524):
    valid = [record for record in records if record.get("valid")]
    if len(valid) < 2:
        raise HTTPException(status_code=400, detail="AutoSplice requires at least two valid LAS files.")
    valid.sort(key=lambda item: item["depth_min"])
    depth_min = min(record["depth_min"] for record in valid)
    depth_max = max(record["depth_max"] for record in valid)
    if depth_max <= depth_min:
        raise HTTPException(status_code=400, detail="Invalid LAS depth ranges.")
    depth = np.arange(depth_min, depth_max + step / 2.0, step)
    if len(depth) > 250000:
        depth = np.linspace(depth_min, depth_max, 250000)

    curve_names = sorted({curve for record in valid for curve in record["curves"]})
    merged = pd.DataFrame({"DEPTH": depth})
    for curve in curve_names:
        merged[curve] = np.nan
        for record in valid:
            df = record["df"]
            if curve not in df.columns:
                continue
            source = df[["DEPTH", curve]].dropna()
            if source.empty:
                continue
            values = np.interp(depth, source["DEPTH"].values, source[curve].values, left=np.nan, right=np.nan)
            mask = np.isnan(merged[curve].values) & np.isfinite(values)
            merged.loc[mask, curve] = values[mask]

    las = lasio.LASFile()
    las.well["WELL"] = lasio.HeaderItem("WELL", value="AUTOSPLICED_OUTPUT", descr="Merged Drake AI AutoSplice well")
    las.well["STRT"] = lasio.HeaderItem("STRT", unit="FT", value=float(depth_min), descr="Start depth")
    las.well["STOP"] = lasio.HeaderItem("STOP", unit="FT", value=float(depth_max), descr="Stop depth")
    las.well["STEP"] = lasio.HeaderItem("STEP", unit="FT", value=float(step), descr="Step")
    las.well["NULL"] = lasio.HeaderItem("NULL", value=-999.25, descr="Null value")
    las.append_curve("DEPT", merged["DEPTH"].values, unit="FT", descr="Depth")
    for curve in curve_names:
        las.append_curve(curve, merged[curve].fillna(-999.25).values, descr=f"AutoSpliced {curve}")
    las.write(str(output_path), version=2.0, wrap=False)
    return valid, merged, curve_names


def _autosplice_figure(merged: pd.DataFrame, selected: list[str], boundaries: list[float]):
    colors = ["#FACC15", "#38BDF8", "#FB7185", "#22C55E", "#A78BFA"]
    selected = [curve for curve in selected if curve in merged.columns][:5]
    data = []
    for index, curve in enumerate(selected):
        data.append({
            "x": _sanitize_list(merged[curve].values),
            "y": _sanitize_list(merged["DEPTH"].values),
            "type": "scatter",
            "mode": "lines",
            "name": curve,
            "xaxis": f"x{index + 1}" if index else "x",
            "line": {"color": colors[index % len(colors)], "width": 2},
            "hovertemplate": f"Depth: %{{y:.2f}}<br>{curve}: %{{x:.4f}}<extra></extra>",
        })
    axis_width = 1 / max(len(selected), 1)
    shapes = []
    for depth in boundaries:
        shapes.append({
            "type": "line",
            "xref": "paper",
            "x0": 0,
            "x1": 1,
            "y0": depth,
            "y1": depth,
            "line": {"color": "#EF4444", "width": 1.5, "dash": "dash"},
        })
    layout = {
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "#06111F",
        "height": 640,
        "margin": {"l": 70, "r": 30, "t": 50, "b": 45},
        "yaxis": {"title": "Depth", "autorange": "reversed", "gridcolor": "#1E293B", "color": "#BBD7FF"},
        "shapes": shapes,
        "legend": {"orientation": "h", "x": 0, "y": 1.08},
        "hovermode": "closest",
    }
    for index, curve in enumerate(selected):
        key = "xaxis" if index == 0 else f"xaxis{index + 1}"
        layout[key] = {
            "title": curve,
            "domain": [index * axis_width + 0.01, (index + 1) * axis_width - 0.01],
            "anchor": "y",
            "side": "top",
            "gridcolor": "#1E293B",
            "color": "#BBD7FF",
        }
    return {"data": data, "layout": layout}


@router.post('/autosplice/run')
async def run_autosplice(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Upload at least two LAS files for AutoSplice.")
    run_id = str(uuid.uuid4())
    run_dir = Path("uploads") / "petrophysics" / "autosplice" / run_id
    input_dir = run_dir / "inputs"
    input_dir.mkdir(parents=True, exist_ok=True)

    validation = []
    for upload in files:
        name = _safe_filename(upload.filename or "upload.las")
        if not name.lower().endswith(".las"):
            validation.append({"valid": False, "file_name": name, "error": "Only LAS files are supported."})
            continue
        path = input_dir / name
        with path.open("wb") as handle:
            handle.write(await upload.read())
        validation.append(_validate_autosplice_las(path))

    output_path = run_dir / "AutoSpliced_Output.las"
    valid, merged, curve_names = _write_spliced_las(validation, output_path)
    provenance_path = run_dir / "autosplice_provenance.json"
    provenance = {
        "run_id": run_id,
        "engine": "Drake AutoSplice integrated fallback",
        "input_files": [{key: value for key, value in record.items() if key not in ("df", "las")} for record in validation],
        "selected_files": [record["file_name"] for record in valid],
        "depth_min": _safe_float(merged["DEPTH"].min()),
        "depth_max": _safe_float(merged["DEPTH"].max()),
        "output_curves": curve_names,
    }
    provenance_path.write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    autosplice_store[run_id] = {"run_dir": str(run_dir), "output": str(output_path), "provenance": str(provenance_path)}
    selected_curves = [curve for curve in ["GR", "RHOB", "NPHI", "DT", "RT"] if curve in curve_names] or curve_names[:5]
    return {
        "run_id": run_id,
        "file_summary": provenance["input_files"],
        "output": {
            "file_name": output_path.name,
            "depth_min": provenance["depth_min"],
            "depth_max": provenance["depth_max"],
            "rows": int(len(merged)),
            "curve_count": len(curve_names),
            "curves": curve_names,
        },
        "figure": _autosplice_figure(merged, selected_curves, [record["depth_min"] for record in valid[1:]]),
        "download_url": f"/api/petrophysics/autosplice/download/{run_id}/AutoSpliced_Output.las",
        "provenance_url": f"/api/petrophysics/autosplice/download/{run_id}/autosplice_provenance.json",
    }


@router.get('/autosplice/download/{run_id}/{file_name}')
def download_autosplice_file(run_id: str, file_name: str):
    record = autosplice_store.get(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="AutoSplice run not found.")
    safe_name = _safe_filename(file_name)
    path = Path(record["run_dir"]) / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Requested AutoSplice file was not found.")
    return FileResponse(str(path), filename=safe_name)


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


@router.post('/histogram/load-demo')
def load_histogram_demo():
    las = _read_histogram_las(_build_demo_las().encode("utf-8"))
    file_id = str(uuid.uuid4())
    histogram_las_store[file_id] = las
    return _histogram_metadata(las, "drake_histogram_demo.las", file_id)


@router.post('/histogram/upload-las')
async def upload_histogram_las(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".las"):
        raise HTTPException(status_code=400, detail="Please upload a valid .las file")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded LAS file is empty")
    try:
        las = _read_histogram_las(content)
        file_id = str(uuid.uuid4())
        histogram_las_store[file_id] = las
        return _histogram_metadata(las, file.filename, file_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse LAS file: {exc}")


@router.post('/histogram/generate')
def generate_histogram(request: HistogramRequest):
    las = histogram_las_store.get(request.file_id)
    if las is None:
        raise HTTPException(status_code=404, detail="Histogram LAS file not found. Upload or load a LAS file again.")

    try:
        curve_data = las[request.curve_name]
        depth_data = las.index
    except Exception:
        raise HTTPException(status_code=400, detail=f"Curve '{request.curve_name}' not found")

    df = pd.DataFrame({"depth": depth_data, "value": curve_data})
    try:
        null_value = float(las.well["NULL"].value)
    except Exception:
        null_value = -999.25
    df["value"] = pd.to_numeric(df["value"], errors="coerce").replace(null_value, np.nan)
    df["depth"] = pd.to_numeric(df["depth"], errors="coerce")
    df = df.dropna(subset=["depth", "value"])

    if df.empty:
        raise HTTPException(status_code=400, detail="No valid numeric samples found for the selected curve.")

    depth_from = request.depth_from if request.depth_from is not None else float(df["depth"].min())
    depth_to = request.depth_to if request.depth_to is not None else float(df["depth"].max())
    df = df[(df["depth"] >= depth_from) & (df["depth"] <= depth_to)]

    if len(df) < 5:
        raise HTTPException(status_code=400, detail="Not enough valid data points in selected depth range")

    values = df["value"].to_numpy(dtype=float)

    if request.scale_type == "Logarithmic":
        values = values[values > 0]
        if len(values) < 5:
            raise HTTPException(status_code=400, detail="Not enough positive values for log scale")

    if request.custom_min is not None and request.custom_max is not None:
        values = values[(values >= request.custom_min) & (values <= request.custom_max)]

    if len(values) < 5:
        raise HTTPException(status_code=400, detail="Not enough data after filtering")

    bins = max(5, min(int(request.bins), 100))
    counts, bin_edges = np.histogram(values, bins=bins)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

    kde_x = None
    kde_y = None
    if request.kde_enabled and len(values) > 10 and np.nanstd(values) > 0:
        try:
            kde = gaussian_kde(values)
            kde_x_arr = np.linspace(values.min(), values.max(), 300)
            kde_y_arr = kde(kde_x_arr) * len(values) * (bin_edges[1] - bin_edges[0])
            kde_x = kde_x_arr.tolist()
            kde_y = kde_y_arr.tolist()
        except Exception:
            kde_x = None
            kde_y = None

    total_samples = int(len(las.index))
    selected_count = int(len(df[df["depth"].between(depth_from, depth_to)]))
    missing = max(0, total_samples - selected_count)
    missing_pct = round((missing / total_samples) * 100, 2) if total_samples > 0 else 0
    skewness = float(stats.skew(values))
    kurtosis = float(stats.kurtosis(values))

    stat_dict = {
        "count": int(len(values)),
        "min": round(float(np.min(values)), 4),
        "max": round(float(np.max(values)), 4),
        "mean": round(float(np.mean(values)), 4),
        "median": round(float(np.median(values)), 4),
        "std": round(float(np.std(values)), 4),
        "variance": round(float(np.var(values)), 4),
        "p10": round(float(np.percentile(values, 10)), 4),
        "p25": round(float(np.percentile(values, 25)), 4),
        "p50": round(float(np.percentile(values, 50)), 4),
        "p75": round(float(np.percentile(values, 75)), 4),
        "p90": round(float(np.percentile(values, 90)), 4),
        "missing_values": int(missing),
        "missing_percentage": missing_pct,
        "skewness": round(skewness, 4),
        "kurtosis": round(kurtosis, 4),
    }

    unit = ""
    for curve in las.curves:
        if curve.mnemonic == request.curve_name:
            unit = curve.unit or ""
            break

    z_scores = np.abs(stats.zscore(values))
    outlier_pct = round(float(np.sum(z_scores > 3) / len(values) * 100), 2)
    completeness = round(100 - missing_pct, 2)
    quality_score = round(max(0, min(100, completeness - outlier_pct * 0.5)), 1)
    if quality_score >= 90:
        quality_label = "Excellent"
    elif quality_score >= 75:
        quality_label = "Good"
    elif quality_score >= 50:
        quality_label = "Moderate"
    else:
        quality_label = "Poor"

    if abs(skewness) < 0.5:
        distribution_type = "Normal"
    elif skewness > 1.5:
        distribution_type = "Highly Right-Skewed"
    elif skewness > 0.5:
        distribution_type = "Right-Skewed"
    elif skewness < -1.5:
        distribution_type = "Highly Left-Skewed"
    else:
        distribution_type = "Left-Skewed"

    analytics = {
        "completeness": completeness,
        "missing_percentage": missing_pct,
        "outlier_percentage": outlier_pct,
        "quality_score": quality_score,
        "quality_label": quality_label,
        "distribution_type": distribution_type,
        "ai_confidence": round(min(99, quality_score * 0.9 + (10 - min(10, outlier_pct)) * 0.5), 1),
    }

    return {
        "curve_name": request.curve_name,
        "unit": unit,
        "histogram": {
            "counts": counts.tolist(),
            "bin_edges": bin_edges.tolist(),
            "bin_centers": bin_centers.tolist(),
        },
        "kde": {"x": kde_x, "y": kde_y} if kde_x is not None else None,
        "statistics": stat_dict,
        "analytics": analytics,
    }


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

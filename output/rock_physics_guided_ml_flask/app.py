from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from typing import Any

import lasio
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request
from sklearn.ensemble import ExtraTreesRegressor, RandomForestClassifier
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


app = Flask(__name__)
SESSIONS: dict[str, dict[str, Any]] = {}
NULL_VALUES = [-999.25, -9999.0, -999.0, -99999.0, 999.25]


@dataclass
class PredictionResult:
    target: str
    task: str
    rows: list[dict[str, Any]]
    metrics: dict[str, Any]
    feature_importance: list[dict[str, Any]]
    zone_summary: list[dict[str, Any]]
    available_features: list[str]
    derived_features: list[str]
    measured_target: bool


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "module": "Rock Physics Guided ML"})


@app.post("/api/sample")
def sample():
    session_id = str(uuid.uuid4())
    df = build_demo_frame()
    SESSIONS[session_id] = {"df": df, "file_name": "rock_physics_guided_demo.las"}
    return jsonify(summary(session_id, "rock_physics_guided_demo.las", df))


@app.post("/api/upload-las")
def upload_las():
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "Please upload a LAS file."}), 400
    if not file.filename.lower().endswith(".las"):
        return jsonify({"error": "Only .las files are supported."}), 400
    try:
        df = read_las(file.read())
    except Exception as exc:
        return jsonify({"error": f"Unable to parse LAS file: {exc}"}), 400
    if df.empty or len(df.columns) < 3:
        return jsonify({"error": "LAS file does not contain enough usable curves."}), 400
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {"df": df, "file_name": file.filename}
    return jsonify(summary(session_id, file.filename, df))


@app.post("/api/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    session_id = payload.get("session_id")
    session = SESSIONS.get(session_id)
    if not session:
        return jsonify({"error": "Session expired. Load sample data or upload LAS again."}), 404
    try:
        result = run_prediction(
            session["df"],
            target=str(payload.get("target") or "PHIE"),
            zone_count=int(payload.get("zone_count") or 3),
            selected_features=payload.get("selected_features"),
        )
    except Exception as exc:
        return jsonify({"error": f"Prediction failed: {exc}"}), 400
    return jsonify(
        {
            "success": True,
            "file_name": session["file_name"],
            "target": result.target,
            "task": result.task,
            "metrics": result.metrics,
            "feature_importance": result.feature_importance,
            "zone_summary": result.zone_summary,
            "available_features": result.available_features,
            "derived_features": result.derived_features,
            "measured_target": result.measured_target,
            "rows": result.rows,
            "preview": result.rows[:250],
        }
    )


def summary(session_id: str, file_name: str, df: pd.DataFrame) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "file_name": file_name,
        "rows": int(len(df)),
        "depth_min": safe_float(df["DEPTH"].min()) if "DEPTH" in df and len(df) else None,
        "depth_max": safe_float(df["DEPTH"].max()) if "DEPTH" in df and len(df) else None,
        "curves": [col for col in df.columns if col != "DEPTH"],
        "targets": ["PHIE", "SW", "VSH", "KLOG", "FACIES"],
    }


def read_las(content: bytes) -> pd.DataFrame:
    text = content.decode("utf-8-sig", errors="replace")
    las = lasio.read(io.StringIO(text), ignore_data=False)
    return normalize_frame(las.df().reset_index())


def build_demo_frame() -> pd.DataFrame:
    depths = np.arange(6200.0, 7600.5, 0.5)
    rng = np.random.default_rng(2026)
    zone_shift = np.select([depths < 6660, depths < 7110], [0.0, 0.08], default=-0.05)
    gr = 72 + 24 * np.sin(depths / 85) + 18 * zone_shift + rng.normal(0, 5, len(depths))
    rhob = 2.47 - 0.18 * np.sin(depths / 130 + 0.4) + 0.08 * zone_shift + rng.normal(0, 0.025, len(depths))
    nphi = 0.21 + 0.06 * np.sin(depths / 115 + 1.1) - 0.04 * zone_shift + rng.normal(0, 0.014, len(depths))
    dt = 78 + 10 * np.cos(depths / 150) - 5 * zone_shift + rng.normal(0, 2.2, len(depths))
    dts = 140 + 18 * np.cos(depths / 165 + 0.2) - 7 * zone_shift + rng.normal(0, 4.0, len(depths))
    rt = np.clip(18 + 42 * np.sin(depths / 180 + 0.7) - 12 * zone_shift + rng.lognormal(1.0, 0.35, len(depths)), 0.3, 180)
    phie = np.clip((2.65 - rhob) / (2.65 - 1.05) * 0.72 + nphi * 0.28 - gr / 850, 0.02, 0.34)
    sw = np.clip((0.18 / np.maximum(rt * np.maximum(phie, 0.04) ** 2, 0.001)) ** 0.5, 0.05, 1.0)
    vsh = np.clip((gr - np.nanpercentile(gr, 5)) / max(np.nanpercentile(gr, 95) - np.nanpercentile(gr, 5), 1), 0, 1)
    klog = np.clip(9000 * np.maximum(phie, 0.01) ** 4 / np.maximum(sw, 0.08) ** 2, 0.01, 5000)
    return pd.DataFrame({"DEPTH": depths, "GR": gr, "RHOB": rhob, "NPHI": nphi, "DT": dt, "DTS": dts, "RT": rt, "PHIE": phie, "SW": sw, "VSH": vsh, "KLOG": klog})


def normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame.columns = [str(col).strip().upper() for col in frame.columns]
    if "DEPTH" not in frame.columns:
        first_col = frame.columns[0]
        frame.rename(columns={first_col: "DEPTH"}, inplace=True)
    for column in frame.columns:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame.replace(NULL_VALUES, np.nan, inplace=True)
    frame.dropna(subset=["DEPTH"], inplace=True)
    frame.sort_values("DEPTH", inplace=True)
    frame.reset_index(drop=True, inplace=True)
    return frame


def add_features(df: pd.DataFrame, zone_count: int) -> tuple[pd.DataFrame, list[str]]:
    frame = normalize_frame(df)
    derived = []
    if "GR" in frame.columns:
        gr_min = frame["GR"].quantile(0.05)
        gr_max = frame["GR"].quantile(0.95)
        frame["VSH_GR"] = ((frame["GR"] - gr_min) / max(gr_max - gr_min, 1e-6)).clip(0, 1)
        derived.append("VSH_GR")
    if {"RHOB", "NPHI"}.issubset(frame.columns):
        frame["DEN_NEU_SEP"] = frame["RHOB"] - (1.95 + frame["NPHI"] * 2.2)
        frame["PHI_DENSITY"] = ((2.65 - frame["RHOB"]) / (2.65 - 1.05)).clip(0, 0.45)
        frame["PHI_DN_BLEND"] = (frame["PHI_DENSITY"] * 0.65 + frame["NPHI"].clip(0, 0.55) * 0.35).clip(0, 0.45)
        derived.extend(["DEN_NEU_SEP", "PHI_DENSITY", "PHI_DN_BLEND"])
    if "DT" in frame.columns:
        frame["VP_FTPS"] = 1000000.0 / frame["DT"].replace(0, np.nan)
        derived.append("VP_FTPS")
    if {"VP_FTPS", "RHOB"}.issubset(frame.columns):
        frame["ACOUSTIC_IMPEDANCE"] = frame["VP_FTPS"] * frame["RHOB"]
        derived.append("ACOUSTIC_IMPEDANCE")
    if {"DT", "DTS"}.issubset(frame.columns):
        frame["VPVS"] = frame["DTS"].replace(0, np.nan) / frame["DT"].replace(0, np.nan)
        derived.append("VPVS")
    if "RT" in frame.columns:
        frame["LOG_RT"] = np.log10(frame["RT"].clip(lower=0.001))
        derived.append("LOG_RT")
    span = max(float(frame["DEPTH"].max() - frame["DEPTH"].min()), 1.0)
    frame["DEPTH_TREND"] = (frame["DEPTH"] - frame["DEPTH"].min()) / span
    frame["ZONE_ID"] = pd.cut(frame["DEPTH"], bins=int(np.clip(zone_count, 1, 8)), labels=False, include_lowest=True).astype(float)
    derived.extend(["DEPTH_TREND", "ZONE_ID"])
    return frame, derived


def synthetic_target(frame: pd.DataFrame, target: str) -> tuple[pd.Series, str]:
    target = target.upper()
    if target in {"PHIE", "POROSITY"}:
        return frame.get("PHI_DN_BLEND", pd.Series(0.12, index=frame.index)).clip(0, 0.45), "regression"
    if target in {"VSH", "VCL", "SHALE_VOLUME"}:
        return frame.get("VSH_GR", pd.Series(0.45, index=frame.index)).clip(0, 1), "regression"
    if target in {"SW", "WATER_SATURATION"}:
        phi = frame.get("PHI_DN_BLEND", pd.Series(0.16, index=frame.index)).clip(0.04, 0.4)
        rt = frame.get("RT", pd.Series(20.0, index=frame.index)).clip(0.2, 1000)
        return ((0.18 / (rt * phi**2)).clip(lower=0) ** 0.5).clip(0.03, 1.0), "regression"
    if target in {"KLOG", "PERM", "PERMEABILITY"}:
        phi = frame.get("PHI_DN_BLEND", pd.Series(0.14, index=frame.index)).clip(0.01, 0.42)
        sw = ((0.18 / (frame.get("RT", pd.Series(20.0, index=frame.index)).clip(0.2, 1000) * phi**2)).clip(lower=0) ** 0.5).clip(0.05, 1.0)
        return (9000.0 * phi**4 / sw**2).clip(0.01, 10000), "regression"
    if target == "FACIES":
        vsh = frame.get("VSH_GR", pd.Series(0.45, index=frame.index)).fillna(0.45)
        phi = frame.get("PHI_DN_BLEND", pd.Series(0.14, index=frame.index)).fillna(0.14)
        rt = frame.get("RT", pd.Series(10.0, index=frame.index)).fillna(10.0)
        labels = np.where(vsh > 0.62, "Shale", np.where(phi > 0.18, np.where(rt > 25, "Pay Sand", "Wet Sand"), "Tight Rock"))
        return pd.Series(labels, index=frame.index), "classification"
    return frame.get("PHI_DN_BLEND", pd.Series(0.12, index=frame.index)).clip(0, 0.45), "regression"


def run_prediction(df: pd.DataFrame, target: str, zone_count: int, selected_features: list[str] | None = None) -> PredictionResult:
    frame, derived = add_features(df, zone_count)
    target = target.upper()
    measured_target = target in frame.columns and frame[target].notna().sum() >= 30
    target_values, task = (frame[target], "classification" if target == "FACIES" else "regression") if measured_target else synthetic_target(frame, target)
    blocked = {"DEPTH", target}
    features = [col for col in frame.select_dtypes(include=[np.number]).columns if col not in blocked and frame[col].notna().sum() >= max(20, int(len(frame) * 0.2))]
    if selected_features:
        wanted = {item.upper() for item in selected_features}
        features = [feature for feature in features if feature in wanted]
    if not features:
        raise ValueError("No usable numeric features are available.")
    X_all = frame[features].copy().fillna(frame[features].median(numeric_only=True)).fillna(0)
    valid = pd.Series(target_values).notna()
    X = X_all.loc[valid]
    y_raw = pd.Series(target_values).loc[valid]
    if len(X) < 30:
        raise ValueError("At least 30 valid samples are required.")

    if task == "classification":
        encoder = LabelEncoder()
        y = encoder.fit_transform(y_raw.astype(str))
        model = RandomForestClassifier(n_estimators=220, random_state=42, min_samples_leaf=4, class_weight="balanced")
        stratify = y if len(np.unique(y)) > 1 and min(np.bincount(y)) > 2 else None
    else:
        encoder = None
        y = y_raw.astype(float).to_numpy()
        model = ExtraTreesRegressor(n_estimators=260, random_state=42, min_samples_leaf=3, bootstrap=True)
        stratify = None

    if len(X) >= 80:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.22, random_state=42, stratify=stratify)
    else:
        X_train, X_test, y_train, y_test = X, X, y, y
    model.fit(X_train, y_train)
    holdout = model.predict(X_test)

    if task == "classification":
        score = float(accuracy_score(y_test, holdout))
        metrics = {"accuracy": round(score, 4), "confidence": confidence_label(score), "validation_samples": int(len(X_test))}
    else:
        score = float(r2_score(y_test, holdout)) if len(y_test) > 1 else 1.0
        metrics = {"r2_score": round(score, 4), "mae": round(float(mean_absolute_error(y_test, holdout)), 5), "confidence": confidence_label(score), "validation_samples": int(len(X_test))}

    predictions = model.predict(X_all)
    p10, p90 = prediction_intervals(model, X_all, task)
    if task == "classification" and encoder is not None:
        prediction_values = encoder.inverse_transform(predictions.astype(int)).tolist()
        confidence = np.max(model.predict_proba(X_all), axis=1) * 100
    else:
        prediction_values = [float(value) for value in predictions]
        confidence = np.clip(55 + np.nan_to_num(score, nan=0.5) * 35, 45, 98) * np.ones(len(frame))

    rows = []
    for index, row in frame.iterrows():
        item = {"DEPTH": safe_float(row["DEPTH"]), "ZONE_ID": int(row["ZONE_ID"]) + 1 if pd.notna(row["ZONE_ID"]) else None, "PREDICTION": prediction_values[index], "CONFIDENCE": round(float(confidence[index]), 2)}
        if measured_target:
            item["MEASURED"] = safe_float(row[target])
        if p10 is not None and p90 is not None:
            item["P10"] = safe_float(p10[index])
            item["P90"] = safe_float(p90[index])
        rows.append(item)

    importance = sorted([{"feature": feature, "importance": round(float(value), 5)} for feature, value in zip(features, model.feature_importances_)], key=lambda item: item["importance"], reverse=True)
    return PredictionResult(target, task, rows, metrics, importance[:12], zone_summary(pd.DataFrame(rows), task), features, derived, measured_target)


def prediction_intervals(model: Any, features: pd.DataFrame, task: str):
    if task != "regression" or not hasattr(model, "estimators_"):
        return None, None
    values = features.to_numpy()
    tree_predictions = np.vstack([tree.predict(values) for tree in model.estimators_])
    return np.nanpercentile(tree_predictions, 10, axis=0), np.nanpercentile(tree_predictions, 90, axis=0)


def zone_summary(rows: pd.DataFrame, task: str) -> list[dict[str, Any]]:
    output = []
    for zone_id, group in rows.groupby("ZONE_ID"):
        item = {"zone": int(zone_id), "samples": int(len(group)), "depth_from": safe_float(group["DEPTH"].min()), "depth_to": safe_float(group["DEPTH"].max()), "avg_confidence": round(float(group["CONFIDENCE"].mean()), 2)}
        if task == "classification":
            mode = group["PREDICTION"].mode()
            item["dominant_prediction"] = str(mode.iloc[0]) if not mode.empty else None
        else:
            values = pd.to_numeric(group["PREDICTION"], errors="coerce")
            item["mean_prediction"] = safe_float(values.mean())
            item["p10"] = safe_float(values.quantile(0.1))
            item["p90"] = safe_float(values.quantile(0.9))
        output.append(item)
    return output


def confidence_label(score: float) -> str:
    if score >= 0.82:
        return "High"
    if score >= 0.62:
        return "Medium"
    return "Review Required"


def safe_float(value: Any):
    try:
        parsed = float(value)
    except Exception:
        return None
    if not np.isfinite(parsed):
        return None
    return round(parsed, 6)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5055, debug=True)

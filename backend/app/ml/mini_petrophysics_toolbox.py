import io
import json
import os
import re
import tempfile
from typing import Optional

import lasio
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from scipy.signal import find_peaks, savgol_filter
from sklearn.cluster import KMeans, MiniBatchKMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

ALIASES = {
    "GR": ["GR", "GAMMA", "GAMMA_RAY", "CGR", "SGR"],
    "RHOB": ["RHOB", "RHOZ", "DEN", "DENS", "DENSITY", "ZDEN"],
    "NPHI": ["NPHI", "NPOR", "NEUT", "NEUTRON", "TNPH", "PHIND"],
    "RT": ["RT", "ILD", "ILD_LOG10", "LLD", "RES", "RESD", "AT90", "RDEP", "DEEP_RES"],
    "DT": ["DT", "DTC", "AC", "SONIC"],
    "PE": ["PE", "PEF", "PEFZ"],
}


def norm(value):
    return str(value).upper().replace(" ", "_").replace("-", "_").replace(".", "_")


def automap_curves(df: pd.DataFrame) -> dict[str, str | None]:
    names = {norm(c): c for c in df.columns}
    out: dict[str, str | None] = {}
    for key, aliases in ALIASES.items():
        found = None
        for alias in aliases:
            an = norm(alias)
            for n, c in names.items():
                if n == an or n.endswith("_" + an) or an in n.split("_"):
                    found = c
                    break
            if found:
                break
        out[key] = found
    return out


def formation_name_column(df: pd.DataFrame):
    for col in df.columns:
        n = norm(col)
        if any(token in n for token in ["FORMATION", "FORM", "ZONE", "MEMBER", "TOP_NAME"]):
            return col
    return None


def name_from_input(df: pd.DataFrame, depth_col: str, top_depth: float):
    name_col = formation_name_column(df)
    if name_col:
        work = df[[depth_col, name_col]].copy()
        work[depth_col] = pd.to_numeric(work[depth_col], errors="coerce")
        work = work.dropna(subset=[depth_col])
        if not work.empty:
            idx = (work[depth_col] - top_depth).abs().idxmin()
            value = str(work.loc[idx, name_col]).strip()
            if value and value.lower() not in {"nan", "none", "unknown"}:
                return value
    return f"Auto Top @ {top_depth:.2f}"


def odd_window(length: int, requested: int):
    window = max(5, int(requested))
    if window % 2 == 0:
        window += 1
    if window >= length:
        window = length - 1 if (length - 1) % 2 else length - 2
    return max(5, window)


def _safe_float(value):
    if value is None:
        return None
    try:
        parsed = float(value)
    except Exception:
        return None
    if np.isnan(parsed) or np.isinf(parsed):
        return None
    return parsed


def _figure_json(fig: go.Figure) -> dict:
    return json.loads(fig.to_json())


def _legacy_las_other_frame(text: str) -> pd.DataFrame:
    lines = text.splitlines()
    start = None
    for index, line in enumerate(lines):
        if line.strip().upper().startswith("~OTHER"):
            start = index + 1
            break
    if start is None:
        return pd.DataFrame()

    header = None
    rows: list[list[str]] = []
    for line in lines[start:]:
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", ";", "!", "*")):
            continue
        if stripped.startswith("~"):
            break
        parts = re.split(r"\s+", stripped)
        if header is None and any(re.search(r"[A-Za-z]", part) for part in parts):
            header = parts
            continue
        if header and len(parts) >= len(header):
            rows.append(parts[:len(header)])

    if not header or not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=[str(col).strip().upper() for col in header])
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df.replace([-999.25, -9999.0, 999.25], np.nan, inplace=True)
    depth_col = df.columns[0]
    df.dropna(subset=[depth_col], inplace=True)
    df.sort_values(depth_col, inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def read_well_log_bytes(file_name: str, content: bytes):
    name = file_name.lower()

    if name.endswith(".las"):
        text = content.decode("utf-8", errors="ignore")
        las = lasio.read(io.StringIO(text))
        df = las.df().reset_index()
        for col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df.replace([-999.25, -9999.0, 999.25], np.nan, inplace=True)
        if df.empty:
            df = _legacy_las_other_frame(text)
        well = ""
        try:
            well = (las.well.WELL.value or "").strip()
        except Exception:
            well = ""
        return df, well or name.replace(".las", ""), las

    if name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content)), name.replace(".csv", ""), None

    if name.endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(content)), name.replace(".xlsx", ""), None

    if name.endswith((".sgy", ".segy")):
        try:
            import segyio
        except ImportError as exc:
            raise ValueError("Install segyio for SEG-Y support.") from exc
        path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp.write(content)
                path = tmp.name
            with segyio.open(path, "r") as seg:
                traces = {f"T{i + 1}": seg.trace[i] for i in range(len(seg.trace))}
                depths = seg.samples
            df = pd.DataFrame(traces)
            df.insert(0, "Depth_from_SEGY", depths)
            return df, name.replace(".sgy", "").replace(".segy", ""), None
        finally:
            if path and os.path.exists(path):
                os.unlink(path)

    raise ValueError("Unsupported format.")


def dataframe_summary(df: pd.DataFrame, file_name: str, well_name: str, session_id: str) -> dict:
    columns = [str(c) for c in df.columns]
    numeric = df.select_dtypes(include=np.number).columns.astype(str).tolist()
    depth_guess = next((c for c in columns if c.lower().startswith(("depth", "md", "tvd"))), columns[0] if columns else "")
    return {
        "session_id": session_id,
        "file_name": file_name,
        "well_name": well_name,
        "rows": int(len(df)),
        "columns": columns,
        "numeric_columns": numeric,
        "depth_guess": depth_guess,
    }


def facies_colors(series: pd.Series) -> list[str]:
    palette = px.colors.qualitative.Safe + px.colors.qualitative.Pastel
    uniq = sorted(series.dropna().astype(str).unique().tolist())
    cmap = {v: palette[i % len(palette)] for i, v in enumerate(uniq)}
    return series.astype(str).map(cmap).tolist()


def build_log_panel(
    df: pd.DataFrame,
    depth_col: str,
    curves: list[str],
    facies_pred: Optional[pd.Series] = None,
    facies_true: Optional[pd.Series] = None,
) -> dict:
    if len(df) > 2500:
        sample_index = np.linspace(0, len(df) - 1, 2500).astype(int)
        df = df.iloc[sample_index].copy()
        if facies_pred is not None:
            facies_pred = facies_pred.iloc[sample_index]
        if facies_true is not None:
            facies_true = facies_true.iloc[sample_index]

    tracks = curves.copy()
    if facies_pred is not None:
        tracks.append("Predicted")
    if facies_true is not None:
        tracks.append("True")

    fig = make_subplots(rows=1, cols=len(tracks), shared_yaxes=True, horizontal_spacing=0.03, subplot_titles=tracks)
    depth = pd.to_numeric(df[depth_col], errors="coerce")

    for i, col in enumerate(curves, start=1):
        fig.add_trace(
            go.Scattergl(x=pd.to_numeric(df[col], errors="coerce"), y=depth, mode="lines", line=dict(width=2), showlegend=False),
            row=1,
            col=i,
        )

    col_idx = len(curves) + 1
    if facies_pred is not None:
        fig.add_trace(
            go.Scattergl(
                x=[0] * len(depth),
                y=depth,
                mode="markers",
                marker=dict(size=6, color=facies_colors(facies_pred), symbol="square"),
                showlegend=False,
            ),
            row=1,
            col=col_idx,
        )
        col_idx += 1
    if facies_true is not None:
        fig.add_trace(
            go.Scattergl(
                x=[0] * len(depth),
                y=depth,
                mode="markers",
                marker=dict(size=6, color=facies_colors(facies_true), symbol="circle"),
                showlegend=False,
            ),
            row=1,
            col=col_idx,
        )

    fig.update_yaxes(autorange="reversed", title=depth_col, row=1, col=1)
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Barlow, sans-serif", color="#1A1A1A"),
        height=650,
        margin=dict(l=20, r=20, t=40, b=40),
    )
    return _figure_json(fig)


def run_facies_classification(
    df: pd.DataFrame,
    depth_col: str,
    features: list[str],
    algorithm: str,
    target_present: bool = False,
    facies_col: Optional[str] = None,
    n_clusters: int = 5,
) -> dict:
    if len(features) < 3:
        raise ValueError("Select at least three predictor curves.")
    missing = [col for col in [depth_col, *features] if col not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}")

    clean = df.replace([np.inf, -np.inf], np.nan).dropna(subset=features).copy()
    if clean.empty:
        raise ValueError("No valid numeric rows found for the selected features.")
    x = StandardScaler().fit_transform(clean[features].astype(float))

    metrics = None
    if algorithm == "random_forest":
        if not target_present or not facies_col or facies_col not in df.columns:
            raise ValueError("Random Forest needs a selected facies label column.")
        labelled = clean.dropna(subset=[facies_col]).copy()
        if labelled.empty:
            raise ValueError("The selected facies label column has no valid labels after removing NaN rows.")
        y = labelled[facies_col]
        if y.nunique(dropna=True) < 2:
            raise ValueError("Random Forest needs at least two different facies labels.")
        x = StandardScaler().fit_transform(labelled[features].astype(float))
        class_counts = y.value_counts()
        stratify = y if len(class_counts) > 1 and int(class_counts.min()) >= 2 else None
        x_train, x_test, y_train, y_test = train_test_split(x, y, stratify=stratify, test_size=0.2, random_state=42)
        rf = RandomForestClassifier(n_estimators=150, class_weight="balanced", n_jobs=-1, random_state=42)
        rf.fit(x_train, y_train)
        y_pred = rf.predict(x_test)
        clean = labelled
        clean["Predicted_Facies"] = rf.predict(x)
        metrics = {
            "accuracy": _safe_float(accuracy_score(y_test, y_pred)),
            "classification_report": classification_report(y_test, y_pred),
        }
    else:
        if len(clean) > 6000:
            model = MiniBatchKMeans(n_clusters=n_clusters, batch_size=2048, n_init="auto", random_state=42)
        else:
            model = KMeans(n_clusters=n_clusters, n_init="auto", random_state=42)
        clean["Predicted_Facies"] = model.fit_predict(x) + 1

    result_df = df.copy()
    result_df.loc[clean.index, "Predicted_Facies"] = clean["Predicted_Facies"]
    facies_pred = result_df["Predicted_Facies"].astype(str)
    facies_true = result_df[facies_col].astype(str) if target_present and facies_col else None
    preview_cols = [depth_col, *features, "Predicted_Facies"]
    if facies_col and facies_col not in preview_cols:
        preview_cols.append(facies_col)

    return {
        "rows": int(len(result_df)),
        "classified_rows": int(result_df["Predicted_Facies"].notna().sum()),
        "algorithm": "Random Forest (Supervised)" if algorithm == "random_forest" else "K-Means (Unsupervised)",
        "metrics": metrics,
        "figure": build_log_panel(result_df, depth_col, features, facies_pred, facies_true),
        "preview": result_df[preview_cols].head(250).replace({np.nan: None}).to_dict("records"),
        "csv": result_df.to_csv(index=False),
    }


def detect_tops_unsupervised(df: pd.DataFrame, depth_col: str, curves: list[str]) -> pd.DataFrame:
    work = df[[depth_col, *curves]].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
    work = work.dropna(subset=[depth_col])
    work = work.dropna(subset=curves, how="all")
    if len(work) < 7:
        raise ValueError("Not enough valid numeric rows for formation tops detection.")

    depth = work[depth_col].values
    work_curves = work[curves].interpolate(limit_direction="both").bfill().ffill()
    valid_curves = [curve for curve in curves if work_curves[curve].notna().any() and float(work_curves[curve].std() or 0) > 0]
    if len(valid_curves) < 2:
        raise ValueError("Select at least two numeric curves with valid non-constant data.")

    work = work_curves[valid_curves]
    composite = sum((work[c] - work[c].mean()) / (work[c].std() + 1e-9) for c in valid_curves) / len(valid_curves)
    composite = composite.replace([np.inf, -np.inf], np.nan).interpolate(limit_direction="both").bfill().ffill()
    window = min(51 if len(composite) > 200 else 9, len(composite))
    if window % 2 == 0:
        window -= 1
    window = max(5, window)
    polyorder = min(3, window - 2)
    grad = np.gradient(savgol_filter(composite.to_numpy(dtype=float), window, polyorder))
    peaks, props = find_peaks(np.abs(grad), height=np.percentile(np.abs(grad), 90))
    return pd.DataFrame({depth_col: depth[peaks], "Score": props["peak_heights"]}).sort_values("Score", ascending=False)


def detect_tops_professional(
    df: pd.DataFrame,
    depth_col: str,
    curves: list[str],
    sensitivity: float = 18,
    min_thickness: float = 20,
    smooth_window: int = 21,
) -> pd.DataFrame:
    columns = [depth_col, *curves]
    work = df[columns].copy()
    for col in work.columns:
        work[col] = pd.to_numeric(work[col], errors="coerce")
    work = work.replace([np.inf, -np.inf], np.nan).dropna().sort_values(depth_col).reset_index(drop=True)
    empty = pd.DataFrame(columns=["Formation", "Top Depth", "Score", "Confidence %", "Main Evidence Curve", "Interpretation"])
    if len(work) < 30:
        return empty

    depth = work[depth_col].astype(float).values
    window = odd_window(len(work), smooth_window)
    gradient_stack = []
    gradients: dict[str, np.ndarray] = {}
    for curve in curves:
        values = work[curve].astype(float).interpolate().bfill().ffill().values
        if np.nanstd(values) == 0:
            continue
        smooth = savgol_filter(values, window, 2)
        zscore = (smooth - np.nanmean(smooth)) / (np.nanstd(smooth) + 1e-9)
        grad = np.abs(np.gradient(zscore))
        gradients[curve] = grad
        gradient_stack.append(grad)
    if not gradient_stack:
        return empty

    composite = np.mean(np.vstack(gradient_stack), axis=0)
    percentile = max(50, min(98, 100 - float(sensitivity)))
    threshold = np.percentile(composite, percentile)
    diffs = np.diff(depth)
    depth_step = max(float(np.nanmedian(diffs)), 0.1)
    distance = max(1, int(float(min_thickness) / depth_step))
    peaks, _ = find_peaks(composite, height=threshold, distance=distance)
    if len(peaks) == 0:
        return empty

    max_score = float(composite[peaks].max())
    rows = []
    for peak in peaks:
        top_depth = float(depth[peak])
        main_curve = max(gradients, key=lambda c: gradients[c][peak])
        score = float(composite[peak])
        confidence = round(min(98, max(35, 45 + (score / (max_score + 1e-9)) * 50)), 1)
        interpretation = (
            "Strong multi-curve stratigraphic break"
            if confidence >= 80
            else "Moderate log break; review before final pick"
            if confidence >= 60
            else "Weak break; low-confidence candidate"
        )
        rows.append({
            "Formation": name_from_input(df, depth_col, top_depth),
            "Top Depth": round(top_depth, 2),
            "Score": round(score, 4),
            "Confidence %": confidence,
            "Main Evidence Curve": main_curve,
            "Interpretation": interpretation,
        })
    return pd.DataFrame(rows).sort_values("Top Depth").reset_index(drop=True)


def add_bases(tops: pd.DataFrame, max_depth: float):
    if tops.empty:
        return tops
    out = tops.copy().sort_values("Top Depth").reset_index(drop=True)
    out["Base Depth"] = out["Top Depth"].shift(-1).fillna(round(float(max_depth), 2))
    out["Thickness"] = (out["Base Depth"] - out["Top Depth"]).abs().round(2)
    return out


def compare_reference(predicted: pd.DataFrame, reference: pd.DataFrame):
    if predicted.empty or reference.empty:
        return pd.DataFrame()
    depth_cols = [c for c in reference.columns if norm(c) in {"DEPTH", "TOP_DEPTH", "MD", "TVD"} or "DEPTH" in norm(c)]
    name_cols = [c for c in reference.columns if any(x in norm(c) for x in ["FORMATION", "FORM", "TOP", "ZONE", "NAME"])]
    if not depth_cols:
        return pd.DataFrame()
    depth_col = depth_cols[0]
    name_col = name_cols[0] if name_cols else None
    ref = reference[[depth_col] + ([name_col] if name_col else [])].copy()
    ref[depth_col] = pd.to_numeric(ref[depth_col], errors="coerce")
    ref = ref.dropna(subset=[depth_col]).sort_values(depth_col).reset_index(drop=True)
    rows = []
    for _, pick in predicted.iterrows():
        idx = (ref[depth_col] - pick["Top Depth"]).abs().idxmin()
        row = ref.loc[idx]
        rows.append({
            "Detected Top": pick["Formation"],
            "Detected Depth": pick["Top Depth"],
            "Reference Top": row[name_col] if name_col else "Reference Top",
            "Reference Depth": round(float(row[depth_col]), 2),
            "Depth Difference": round(float(pick["Top Depth"] - row[depth_col]), 2),
        })
    return pd.DataFrame(rows)


def plot_multi_track(df: pd.DataFrame, depth_col: str, curves: list[str], tops: list[float], labels: Optional[list[str]] = None) -> dict:
    fig = make_subplots(rows=1, cols=len(curves), shared_yaxes=True, horizontal_spacing=0.03)
    depth = pd.to_numeric(df[depth_col], errors="coerce")
    for i, c in enumerate(curves, 1):
        values = pd.to_numeric(df[c], errors="coerce")
        fig.add_trace(go.Scatter(x=values, y=depth, mode="lines", line=dict(width=3), showlegend=False), row=1, col=i)
        if tops:
            xmin, xmax = values.min(), values.max()
            for d in tops:
                fig.add_shape(type="line", x0=xmin, x1=xmax, y0=d, y1=d, line=dict(color="#ef4444", width=1, dash="dash"), row=1, col=i)
            if i == 1 and labels:
                fig.add_trace(
                    go.Scatter(
                        x=[xmax] * len(tops),
                        y=tops,
                        text=labels,
                        mode="text",
                        showlegend=False,
                        hoverinfo="text",
                        textposition="middle right",
                        textfont=dict(size=9, color="#ef4444"),
                    ),
                    row=1,
                    col=i,
                )
        fig.update_xaxes(title_text=c, row=1, col=i)
    fig.update_yaxes(title=depth_col, autorange="reversed")
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Barlow, sans-serif", color="#1A1A1A"),
        height=740,
        margin=dict(l=40, r=20, t=50, b=30),
        template="plotly_white",
    )
    return _figure_json(fig)


def run_formation_tops_detection(
    df: pd.DataFrame,
    depth_col: str,
    curves: list[str],
    mode: str = "unsupervised",
    tops_df: Optional[pd.DataFrame] = None,
    tops_depth_col: Optional[str] = None,
    formation_col: Optional[str] = None,
    sensitivity: float = 18,
    min_thickness: float = 20,
    smooth_window: int = 21,
    manual_tops: Optional[list[dict]] = None,
) -> dict:
    mapping = automap_curves(df)
    if not curves:
        curves = [mapping[key] for key in ["GR", "RHOB", "NPHI", "RT", "DT", "PE"] if mapping.get(key)]
        curves = list(dict.fromkeys(curves))

    if len(curves) < 2:
        raise ValueError("Select at least two curves.")
    missing = [col for col in [depth_col, *curves] if col not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}")

    if mode == "supervised":
        if tops_df is None or not tops_depth_col or not formation_col:
            raise ValueError("Upload tops data and select depth and formation columns.")
        tops_src = tops_df.copy()
        merged = pd.merge_asof(
            df.sort_values(depth_col),
            tops_src[[tops_depth_col, formation_col]].rename(columns={tops_depth_col: depth_col}).sort_values(depth_col),
            on=depth_col,
            direction="nearest",
            tolerance=0.5,
        )
        labelled = merged.dropna(subset=[formation_col])
        x = labelled[curves].replace([np.inf, -np.inf], np.nan).dropna()
        y = labelled.loc[x.index, formation_col]
        clf = RandomForestClassifier(n_estimators=300, n_jobs=-1, random_state=42)
        clf.fit(StandardScaler().fit_transform(x), y)
        full_x = df[curves].replace([np.inf, -np.inf], np.nan).dropna()
        out_df = df.copy()
        out_df.loc[full_x.index, "PredForm"] = clf.predict(StandardScaler().fit_transform(full_x))
        tops_out = out_df.dropna(subset=["PredForm"])[[depth_col, "PredForm"]].drop_duplicates("PredForm").rename(columns={"PredForm": "Formation"})
    else:
        max_depth = pd.to_numeric(df[depth_col], errors="coerce").max()
        tops_out = add_bases(detect_tops_professional(df, depth_col, curves, sensitivity, min_thickness, smooth_window), max_depth)
        if manual_tops:
            manual_rows = []
            for row in manual_tops:
                try:
                    top_depth = float(row.get("depth"))
                except Exception:
                    continue
                formation = str(row.get("formation") or f"Manual Top @ {top_depth:.2f}").strip()
                manual_rows.append({
                    "Formation": formation,
                    "Top Depth": top_depth,
                    "Score": 0,
                    "Confidence %": 100,
                    "Main Evidence Curve": "Manual Pick",
                    "Interpretation": "User supplied formation top",
                })
            if manual_rows:
                tops_out = add_bases(pd.concat([tops_out, pd.DataFrame(manual_rows)], ignore_index=True), max_depth)

    tops_list = tops_out.replace({np.nan: None}).to_dict("records")
    depth_key = "Top Depth" if "Top Depth" in tops_out.columns else depth_col
    top_depths = [_safe_float(row.get(depth_key)) for row in tops_list]
    top_depths = [value for value in top_depths if value is not None]
    labels = [str(row.get("Formation", "")) for row in tops_list] if "Formation" in tops_out.columns else []
    comparison = compare_reference(tops_out, tops_df) if tops_df is not None and not tops_out.empty else pd.DataFrame()
    return {
        "mode": "Supervised" if mode == "supervised" else "Unsupervised",
        "tops_count": int(len(tops_out)),
        "tops": tops_list,
        "comparison": comparison.replace({np.nan: None}).to_dict("records"),
        "mapping": mapping,
        "depth_col": depth_col,
        "curves": curves,
        "figure": plot_multi_track(df, depth_col, curves[:5], top_depths, labels),
        "csv": tops_out.to_csv(index=False),
    }

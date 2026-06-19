"""Standalone Drake AI prediction engine integrated from the uploaded Flask app.

This keeps the current FastAPI/UI shell while porting the useful prediction
logic from Drake_AI_Prediction_Standalone/app.py: LAS curve aliasing, synthetic
LAS-like ML training, RF/XGB/GB/tree prediction options, P10/P50/P90 bands,
permeability, lithology, confidence, and preview rows.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.tree import DecisionTreeRegressor
except Exception:  # pragma: no cover
    GradientBoostingRegressor = None
    RandomForestRegressor = None
    DecisionTreeRegressor = None

try:
    from xgboost import XGBRegressor
except Exception:  # pragma: no cover
    XGBRegressor = None


def safe_float(value):
    try:
        if value is None:
            return None
        out = float(value)
        if np.isnan(out) or np.isinf(out):
            return None
        return out
    except Exception:
        return None


def to_builtin(value):
    if isinstance(value, dict):
        return {str(k): to_builtin(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_builtin(v) for v in value]
    if isinstance(value, tuple):
        return [to_builtin(v) for v in value]
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return safe_float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def find_log_name(log_names, candidates):
    upper_map = {str(name).upper(): name for name in (log_names or []) if str(name).upper() != "DEPTH"}
    for cand in candidates:
        key = str(cand).upper()
        if key in upper_map:
            return upper_map[key]
    for cand in candidates:
        key = str(cand).upper()
        for log_key, original in upper_map.items():
            if log_key.startswith(key):
                return original
    for cand in candidates:
        key = str(cand).upper()
        for log_key, original in upper_map.items():
            if key.startswith(log_key) and len(log_key) >= 2:
                return original
    for cand in candidates:
        key = str(cand).upper()
        for log_key, original in upper_map.items():
            if key in log_key and len(key) >= 2:
                return original
    return None


def clean_numeric_series(df, col):
    if not col or col not in df.columns:
        return pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    return pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).astype("float64")


def prepare_item_frame(item):
    df = pd.DataFrame(item.get("logs_data", []))
    if df.empty:
        return df, []
    df.columns = [str(col).upper() for col in df.columns]
    if "DEPTH" not in df.columns:
        df["DEPTH"] = np.arange(len(df), dtype=float)
    df["DEPTH"] = pd.to_numeric(df["DEPTH"], errors="coerce").ffill().bfill().fillna(0)
    log_names = [str(col).upper() for col in item.get("log_names", [])]
    if not log_names:
        log_names = [col for col in df.columns if col != "DEPTH"]
    return df, log_names


def predict_vsh_ai(df):
    gr_col = find_log_name(list(df.columns), ["GRD", "GR", "GRS", "GRR", "CGR", "SGR", "HSGR", "GRC", "GAMMA", "GAMMARAY"])
    gr = clean_numeric_series(df, gr_col)
    valid = gr.dropna()
    if valid.empty:
        return pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    gr_min = float(valid.quantile(0.05))
    gr_max = float(valid.quantile(0.95))
    denom = gr_max - gr_min
    if denom == 0:
        return pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    return ((gr - gr_min) / denom).clip(0.0, 1.0).where(gr.notna(), other=np.nan).astype("float64")


def predict_porosity_ai(df):
    rhob_col = find_log_name(list(df.columns), ["RHOB", "RHOZ", "DEN", "ZDEN"])
    nphi_col = find_log_name(list(df.columns), ["NPHI", "NPHIS", "NPHISS", "NPL", "TNPH"])
    dt_col = find_log_name(list(df.columns), ["DT", "DTP", "AC", "SONIC", "DTCO"])
    phid = pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    if rhob_col:
        rhob = clean_numeric_series(df, rhob_col).where(lambda s: (s >= 1.0) & (s <= 3.5))
        phid = ((2.65 - rhob) / (2.65 - 1.0)).clip(0.0, 1.0).where(rhob.notna(), other=np.nan)
    phin = pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    if nphi_col:
        phin = clean_numeric_series(df, nphi_col)
        if phin.dropna().shape[0] and phin.dropna().median() > 1.0:
            phin = phin / 100.0
        phin = phin.where((phin >= -0.15) & (phin <= 1.0)).clip(0.0, 1.0)
    phis = pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    if dt_col:
        dt = clean_numeric_series(df, dt_col)
        phis = ((dt - 55.5) / (189.0 - 55.5)).clip(0.0, 1.0).where(dt.notna(), other=np.nan)
    phit = pd.Series(np.nan, index=df.index, dtype="float64")
    both = phid.notna() & phin.notna()
    phit[both] = np.sqrt((phid[both].values ** 2 + phin[both].values ** 2) / 2.0)
    phit[phid.notna() & phin.isna()] = phid[phid.notna() & phin.isna()]
    phit[phid.isna() & phin.notna()] = phin[phid.isna() & phin.notna()]
    phit[phit.isna() & phis.notna()] = phis[phit.isna() & phis.notna()]
    return phit.clip(0.0, 1.0)


def predict_saturation_ai(df, phie=None):
    rt_col = find_log_name(list(df.columns), ["RT", "RESD", "ILD", "LLD", "AT90", "HDRS", "RDEP"])
    rt = clean_numeric_series(df, rt_col).where(lambda s: s > 0)
    if phie is None:
        phie = predict_porosity_ai(df)
    phie_safe = phie.where(phie > 0.001)
    sw = (((1.0 * 0.10) / ((phie_safe ** 2.0) * rt)) ** 0.5)
    return sw.replace([np.inf, -np.inf], np.nan).clip(0.0, 1.0).where(rt.notna() & phie.notna(), other=np.nan)


def predict_lithology_ai(df, vsh, phie):
    rhob_col = find_log_name(list(df.columns), ["RHOB", "RHOZ", "DEN", "ZDEN"])
    rhob = clean_numeric_series(df, rhob_col)
    labels = []
    for idx in df.index:
        v = vsh.loc[idx]
        rho = rhob.loc[idx]
        phi = phie.loc[idx]
        if pd.notna(rho) and rho < 1.80:
            labels.append("Coal")
        elif pd.notna(rho) and 2.80 <= rho <= 2.90:
            labels.append("Dolomite")
        elif pd.notna(rho) and 2.68 <= rho <= 2.75:
            labels.append("Limestone")
        elif pd.notna(v) and v > 0.50:
            labels.append("Shale")
        elif pd.notna(v) and v > 0.30:
            labels.append("Shaly Sand")
        elif pd.notna(v) and v <= 0.30 and pd.notna(phi) and phi >= 0.10:
            labels.append("Clean Sandstone")
        else:
            labels.append("Unknown")
    return pd.Series(labels, index=df.index, dtype="object")


def raw_ml_feature_frame(df, extra=None):
    cols = list(df.columns)

    def pick(candidates):
        name = find_log_name(cols, candidates)
        return name if name in df.columns else None

    mapping = {
        "GR": pick(["GRD", "GR", "GRS", "GRR", "CGR", "SGR", "HSGR", "GRC", "GAMMA", "GAMMARAY"]),
        "RHOB": pick(["RHOB", "RHOZ", "DEN", "ZDEN"]),
        "NPHI": pick(["NPHI", "NPHIS", "NPHISS", "NPL", "TNPH"]),
        "DT": pick(["DT", "DTP", "AC", "SONIC", "DTCO"]),
        "RT": pick(["RT", "RESD", "ILD", "LLD", "AT90", "HDRS", "RDEP"]),
    }
    X = pd.DataFrame(index=df.index)
    for key, col in mapping.items():
        X[key] = clean_numeric_series(df, col) if col else np.nan
    if extra:
        for key, value in extra.items():
            X[key] = pd.to_numeric(value, errors="coerce")
    if X["NPHI"].dropna().shape[0] and X["NPHI"].dropna().median() > 1.0:
        X["NPHI"] = X["NPHI"] / 100.0
    X["RT"] = X["RT"].where(X["RT"] > 0)
    X["LOG_RT"] = np.log10(X["RT"].clip(lower=1e-3))
    X["DEPTH_TREND"] = pd.to_numeric(df.get("DEPTH", pd.Series(np.arange(len(df)), index=df.index)), errors="coerce")
    if X["DEPTH_TREND"].notna().any():
        dmin, dmax = X["DEPTH_TREND"].min(), X["DEPTH_TREND"].max()
        X["DEPTH_TREND"] = (X["DEPTH_TREND"] - dmin) / ((dmax - dmin) if dmax != dmin else 1.0)
    return X.replace([np.inf, -np.inf], np.nan).ffill().bfill().fillna(0.0).astype("float64")


def synthetic_ml_training_data(n=1800):
    rng = np.random.default_rng(42)
    gr = rng.normal(75, 22, n).clip(5, 180)
    rhob = rng.normal(2.45, 0.14, n).clip(1.75, 2.95)
    nphi = rng.normal(0.22, 0.075, n).clip(0.01, 0.55)
    dt = rng.normal(85, 22, n).clip(40, 165)
    rt = rng.lognormal(mean=2.0, sigma=0.65, size=n).clip(0.15, 500)
    log_rt = np.log10(rt)
    vsh = ((gr - 25) / 120 + rng.normal(0, 0.045, n)).clip(0.0, 1.0)
    phi = (0.34 - (rhob - 2.0) * 0.24 + nphi * 0.32 + (dt - 80) * 0.0011 - gr * 0.00075 + log_rt * 0.008 + rng.normal(0, 0.018, n)).clip(0.02, 0.38)
    sw = (0.88 - log_rt * 0.17 + gr * 0.0014 + nphi * 0.22 - phi * 0.42 + vsh * 0.12 + rng.normal(0, 0.04, n)).clip(0.04, 1.0)
    perm = (8581.0 * (phi ** 4.4) / (np.clip(sw, 0.08, 1.0) ** 2.0))
    perm = (perm * np.exp(rng.normal(0, 0.35, n))).clip(0.001, 10000.0)
    X = pd.DataFrame({"GR": gr, "RHOB": rhob, "NPHI": nphi, "DT": dt, "RT": rt, "LOG_RT": log_rt})
    X["DEPTH_TREND"] = rng.uniform(0, 1, n)
    X["PHIT_ML"] = phi
    X["SW_ML"] = sw
    return X, {"VSH": vsh, "PHIT": phi, "SW": sw, "PERM": np.log10(perm)}


_MODEL_CACHE = {}


def model_display_name(model_name):
    value = str(model_name or "random_forest").lower()
    if value in ("gradient_boosting", "gb", "gbr"):
        return "Gradient Boosting AI"
    if value in ("decision_tree", "tree", "trees"):
        return "Decision Tree AI"
    if value in ("xgboost", "xgb"):
        return "XGBoost AI"
    return "Random Forest AI"


def fit_synthetic_ml_predict(X_in, target_name, model_name="random_forest"):
    train_X, targets = synthetic_ml_training_data()
    y = targets[target_name]
    model_name = str(model_name or "random_forest").lower()
    features = [col for col in train_X.columns if col in X_in.columns]
    if target_name in ("SW", "PERM") and "PHIT_ML" in X_in.columns and "PHIT_ML" in train_X.columns:
        features = [col for col in features if col != "PHIT_ML"] + ["PHIT_ML"]
    if target_name == "PERM" and "SW_ML" in X_in.columns and "SW_ML" in train_X.columns:
        features = [col for col in features if col != "SW_ML"] + ["SW_ML"]
    cache_key = (target_name, model_name, tuple(features))
    model_info = _MODEL_CACHE.get(cache_key)
    rng = np.random.default_rng(123)
    if model_info is None:
        if model_name in ("xgboost", "xgb") and XGBRegressor is not None:
            models = []
            for i in range(4):
                idx = rng.choice(len(train_X), size=len(train_X), replace=True)
                model = XGBRegressor(n_estimators=45, max_depth=3, learning_rate=0.08, subsample=0.86, colsample_bytree=0.86, objective="reg:squarederror", random_state=700 + i, n_jobs=1, verbosity=0)
                model.fit(train_X[features].iloc[idx], y[idx])
                models.append(model)
            model_info = ("ensemble", models)
        elif model_name in ("gradient_boosting", "gb", "gbr") and GradientBoostingRegressor is not None:
            models = []
            for i in range(4):
                idx = rng.choice(len(train_X), size=len(train_X), replace=True)
                model = GradientBoostingRegressor(n_estimators=60, learning_rate=0.08, max_depth=3, random_state=800 + i)
                model.fit(train_X[features].iloc[idx], y[idx])
                models.append(model)
            model_info = ("ensemble", models)
        elif model_name in ("decision_tree", "tree", "trees") and DecisionTreeRegressor is not None:
            models = []
            for i in range(12):
                idx = rng.choice(len(train_X), size=len(train_X), replace=True)
                model = DecisionTreeRegressor(max_depth=7, min_samples_leaf=5, random_state=900 + i)
                model.fit(train_X[features].iloc[idx], y[idx])
                models.append(model)
            model_info = ("ensemble", models)
        elif RandomForestRegressor is not None:
            model = RandomForestRegressor(n_estimators=45, min_samples_leaf=4, random_state=91, n_jobs=-1)
            model.fit(train_X[features], y)
            model_info = ("forest", model)
        else:
            median = float(np.nanmedian(y))
            spread = float(np.nanstd(y) or 0.02)
            return pd.DataFrame({"P10": median - spread, "P50": median, "P90": median + spread, "MEAN": median}, index=X_in.index)
        _MODEL_CACHE[cache_key] = model_info

    kind, model_obj = model_info
    X = X_in[features].copy()
    if kind == "forest":
        preds = [tree.predict(X.values) for tree in model_obj.estimators_]
    else:
        preds = [model.predict(X) for model in model_obj]
    arr = np.asarray(preds, dtype="float64")
    return pd.DataFrame({"P10": np.nanpercentile(arr, 10, axis=0), "P50": np.nanpercentile(arr, 50, axis=0), "P90": np.nanpercentile(arr, 90, axis=0), "MEAN": np.nanmean(arr, axis=0)}, index=X_in.index)


def compute_prediction_sections(item, config=None):
    config = config or {}
    df, _ = prepare_item_frame(item)
    if df.empty:
        return {"success": False, "message": "No log data available."}

    columns = list(df.columns)
    gr_curve = str(config.get("gr_curve") or config.get("gr_log") or "").upper()
    gr_col = gr_curve if gr_curve in df.columns else find_log_name(columns, ["GRD", "GR", "GRS", "GRR", "CGR", "SGR", "HSGR", "GRC", "GAMMA", "GAMMARAY"])
    gr = clean_numeric_series(df, gr_col)
    gr_min = safe_float(config.get("gr_min"))
    gr_max = safe_float(config.get("gr_max"))
    valid_gr = gr.dropna()
    if gr_min is None and not valid_gr.empty:
        gr_min = float(valid_gr.quantile(0.05))
    if gr_max is None and not valid_gr.empty:
        gr_max = float(valid_gr.quantile(0.95))
    denom = (gr_max - gr_min) if gr_min is not None and gr_max is not None and gr_max != gr_min else np.nan
    igr = ((gr - gr_min) / denom).replace([np.inf, -np.inf], np.nan).clip(0.0, 1.0).where(gr.notna(), other=np.nan)
    vsh_method = str(config.get("vsh_method") or config.get("method") or "linear").lower().replace(" ", "_")
    if "larionov" in vsh_method and "tertiary" in vsh_method:
        vsh_emp = (0.083 * ((2.0 ** (3.7 * igr)) - 1.0)).clip(0.0, 1.0)
        vsh_label = "Larionov Tertiary"
    elif "larionov" in vsh_method:
        vsh_emp = (0.33 * ((2.0 ** (2.0 * igr)) - 1.0)).clip(0.0, 1.0)
        vsh_label = "Larionov Older Rocks"
    elif "clavier" in vsh_method:
        vsh_emp = (1.7 - np.sqrt(np.maximum(0.0, 3.38 - ((igr + 0.7) ** 2)))).clip(0.0, 1.0)
        vsh_label = "Clavier"
    elif "steiber" in vsh_method:
        vsh_emp = (igr / (3.0 - 2.0 * igr)).replace([np.inf, -np.inf], np.nan).clip(0.0, 1.0)
        vsh_label = "Steiber"
    else:
        vsh_emp = igr.copy()
        vsh_label = "Linear"
    por_method = str(config.get("porosity_method") or "density").lower()
    por_curve = str(config.get("porosity_curve") or "").upper()
    rhob_col = por_curve if por_curve in df.columns and por_method == "density" else find_log_name(columns, ["RHOB", "RHOZ", "DEN", "ZDEN"])
    nphi_col = por_curve if por_curve in df.columns and por_method == "neutron" else find_log_name(columns, ["NPHI", "NPHIS", "NPHISS", "NPL", "TNPH"])
    dt_col = por_curve if por_curve in df.columns and por_method == "sonic" else find_log_name(columns, ["DT", "DTP", "AC", "SONIC", "DTCO"])
    rhoma = safe_float(config.get("rhoma")) or 2.65
    rhof = safe_float(config.get("rhof")) or 1.0
    dtma = safe_float(config.get("dtma")) or 55.5
    dtfl = safe_float(config.get("dtfl")) or 189.0
    phid = pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    phin = pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    phis = pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
    if rhob_col:
        rhob = clean_numeric_series(df, rhob_col).where(lambda s: (s >= 1.0) & (s <= 3.5))
        phid = ((rhoma - rhob) / ((rhoma - rhof) if rhoma != rhof else np.nan)).clip(0.0, 1.0).where(rhob.notna(), other=np.nan)
    if nphi_col:
        phin = clean_numeric_series(df, nphi_col)
        if str(config.get("nphi_unit") or "fraction").lower() == "percent" or (phin.dropna().shape[0] and phin.dropna().median() > 1.0):
            phin = phin / 100.0
        phin = phin.where((phin >= -0.15) & (phin <= 1.0)).clip(0.0, 1.0)
    if dt_col:
        dt = clean_numeric_series(df, dt_col)
        phis = ((dt - dtma) / ((dtfl - dtma) if dtfl != dtma else np.nan)).clip(0.0, 1.0).where(dt.notna(), other=np.nan)
    if por_method == "neutron":
        phit_emp = phin
    elif por_method == "sonic":
        phit_emp = phis
    elif por_method == "density_neutron":
        phit_emp = pd.Series(np.nan, index=df.index, dtype="float64")
        both = phid.notna() & phin.notna()
        phit_emp[both] = np.sqrt((phid[both].values ** 2 + phin[both].values ** 2) / 2.0)
        phit_emp[phid.notna() & phin.isna()] = phid[phid.notna() & phin.isna()]
        phit_emp[phid.isna() & phin.notna()] = phin[phid.isna() & phin.notna()]
    else:
        phit_emp = phid
    if phit_emp.notna().sum() == 0:
        phit_emp = predict_porosity_ai(df)
    phie_emp = (phit_emp * (1.0 - vsh_emp.fillna(0.0))).where(phit_emp.notna(), other=np.nan).clip(0.0, 1.0)
    rt_col = str(config.get("saturation_curve") or "").upper()
    rt_col = rt_col if rt_col in df.columns else find_log_name(columns, ["RT", "RESD", "ILD", "LLD", "AT90", "HDRS", "RDEP"])
    rt_series = clean_numeric_series(df, rt_col).where(lambda s: s > 0)
    rw = safe_float(config.get("rw")) or 0.1
    rsh = safe_float(config.get("rsh")) or 2.0
    archie_a = safe_float(config.get("archie_a")) or 1.0
    archie_m = safe_float(config.get("archie_m")) or 2.0
    archie_n = safe_float(config.get("archie_n")) or 2.0
    phie_safe = phie_emp.where(phie_emp > 0)
    sw_archie = (((archie_a * rw) / ((phie_safe ** archie_m) * rt_series)) ** (1.0 / archie_n)).replace([np.inf, -np.inf], np.nan).clip(0.0, 1.0).where(rt_series.notna() & phie_emp.notna(), other=np.nan)
    indonesia_shale = (vsh_emp.clip(0.0, 1.0) ** (1.0 - (vsh_emp.clip(0.0, 1.0) / 2.0))) / np.sqrt(max(rsh, 1e-9))
    indonesia_phi = np.sqrt((phie_safe ** archie_m) / max(archie_a * rw, 1e-9))
    indonesia_term = ((1.0 / np.sqrt(rt_series)) - indonesia_shale) / indonesia_phi.replace(0, np.nan)
    sw_indonesia = (indonesia_term.clip(lower=0.0) ** (2.0 / archie_n)).replace([np.inf, -np.inf], np.nan).clip(0.0, 1.0).where(rt_series.notna() & phie_emp.notna(), other=np.nan)
    sat_method = str(config.get("saturation_method") or "archie").lower().replace(" ", "_")
    if "indonesia" in sat_method:
        sw_emp = sw_indonesia.where(sw_indonesia.notna(), sw_archie)
        sat_label = "Indonesia"
    elif "auto" in sat_method:
        shaly = vsh_emp.fillna(0.0) >= 0.35
        sw_emp = sw_archie.copy()
        sw_emp[shaly] = sw_indonesia[shaly].where(sw_indonesia[shaly].notna(), sw_archie[shaly])
        sat_label = "Auto (Archie/Indonesia)"
    else:
        sw_emp = sw_archie
        sat_label = "Archie"
    if sw_emp.notna().sum() == 0:
        sw_emp = predict_saturation_ai(df, phie_emp)

    ai_model = str(config.get("ai_model") or "empirical").lower()
    use_ai = ai_model not in ("", "empirical", "no_ai", "none", "no ai")
    if use_ai:
        X = raw_ml_feature_frame(df, {"VSH": vsh_emp})
        vsh_ml = fit_synthetic_ml_predict(X, "VSH", ai_model)
        X_phi = X.copy()
        X_phi["VSH"] = vsh_ml["P50"]
        phi_ml = fit_synthetic_ml_predict(X_phi, "PHIT", ai_model)
        X_sw = X_phi.copy()
        X_sw["PHIT_ML"] = phi_ml["P50"]
        sw_ml = fit_synthetic_ml_predict(X_sw, "SW", ai_model)
        X_perm = X_sw.copy()
        X_perm["SW_ML"] = sw_ml["P50"]
        perm_ml = fit_synthetic_ml_predict(X_perm, "PERM", ai_model)
    else:
        nan = pd.Series([np.nan] * len(df), index=df.index, dtype="float64")
        vsh_ml = pd.DataFrame({"P10": nan, "P50": vsh_emp, "P90": nan}, index=df.index)
        phi_ml = pd.DataFrame({"P10": nan, "P50": phit_emp, "P90": nan}, index=df.index)
        sw_ml = pd.DataFrame({"P10": nan, "P50": sw_emp, "P90": nan}, index=df.index)
        timur_coeff = safe_float(config.get("timur_coeff")) or 8581.0
        perm_phi_exp = safe_float(config.get("perm_phi_exp")) or 4.4
        perm_swir = safe_float(config.get("perm_swir")) or 0.20
        perm_swir_exp = safe_float(config.get("perm_swir_exp")) or 2.0
        perm_emp = (timur_coeff * (phie_emp.clip(lower=0.0) ** perm_phi_exp) / (max(perm_swir, 1e-6) ** perm_swir_exp)).replace([np.inf, -np.inf], np.nan).clip(lower=0.0)
        perm_ml = pd.DataFrame({"P10": nan, "P50": np.log10(perm_emp.where(perm_emp > 0)), "P90": nan}, index=df.index)

    vsh = vsh_ml["P50"].where(use_ai & vsh_ml["P50"].notna(), vsh_emp).clip(0.0, 1.0)
    phit = phi_ml["P50"].where(use_ai & phi_ml["P50"].notna(), phit_emp).clip(0.0, 1.0)
    phie = (phit * (1.0 - vsh.fillna(0.0))).where(phit.notna(), other=np.nan).clip(0.0, 1.0)
    sw = sw_ml["P50"].where(sw_ml["P50"].notna(), sw_emp).clip(0.0, 1.0)
    perm = np.power(10.0, perm_ml["P50"]).clip(0.001, 10000.0)
    lith = predict_lithology_ai(df, vsh, phie)
    confidence = (96.0 - ((phi_ml["P90"] - phi_ml["P10"]).abs().fillna(0.08) * 190.0) - (vsh.fillna(0.5) * 8.0)).clip(55.0, 98.0)
    reliability = (96.0 - ((sw_ml["P90"] - sw_ml["P10"]).abs().fillna(0.12) * 145.0)).clip(52.0, 98.0)

    records = []
    for i in range(len(df)):
        depth = safe_float(round(float(df["DEPTH"].iloc[i]), 2))
        if depth is None:
            continue
        records.append({
            "DEPTH": depth,
            "GR": safe_float(round(float(gr.iloc[i]), 4)) if pd.notna(gr.iloc[i]) else None,
            "IGR": safe_float(round(float(igr.iloc[i]), 5)) if pd.notna(igr.iloc[i]) else None,
            "VSH": safe_float(round(float(vsh.iloc[i]), 5)) if pd.notna(vsh.iloc[i]) else None,
            "PHIT": safe_float(round(float(phit.iloc[i]), 5)) if pd.notna(phit.iloc[i]) else None,
            "PHIE": safe_float(round(float(phie.iloc[i]), 5)) if pd.notna(phie.iloc[i]) else None,
            "PHI_P10": safe_float(round(float(phi_ml["P10"].iloc[i]), 5)) if pd.notna(phi_ml["P10"].iloc[i]) else None,
            "PHI_P50": safe_float(round(float(phi_ml["P50"].iloc[i]), 5)) if pd.notna(phi_ml["P50"].iloc[i]) else None,
            "PHI_P90": safe_float(round(float(phi_ml["P90"].iloc[i]), 5)) if pd.notna(phi_ml["P90"].iloc[i]) else None,
            "SW": safe_float(round(float(sw.iloc[i]), 5)) if pd.notna(sw.iloc[i]) else None,
            "SW_P10": safe_float(round(float(sw_ml["P10"].iloc[i]), 5)) if pd.notna(sw_ml["P10"].iloc[i]) else None,
            "SW_P50": safe_float(round(float(sw_ml["P50"].iloc[i]), 5)) if pd.notna(sw_ml["P50"].iloc[i]) else None,
            "SW_P90": safe_float(round(float(sw_ml["P90"].iloc[i]), 5)) if pd.notna(sw_ml["P90"].iloc[i]) else None,
            "RT": safe_float(round(float(rt_series.iloc[i]), 4)) if pd.notna(rt_series.iloc[i]) else None,
            "PERM": safe_float(round(float(perm.iloc[i]), 4)) if pd.notna(perm.iloc[i]) else None,
            "PERMEABILITY_MD": safe_float(round(float(perm.iloc[i]), 4)) if pd.notna(perm.iloc[i]) else None,
            "PERM_P10": safe_float(round(float(np.power(10.0, perm_ml["P10"].iloc[i])), 4)) if pd.notna(perm_ml["P10"].iloc[i]) else None,
            "PERM_P50": safe_float(round(float(np.power(10.0, perm_ml["P50"].iloc[i])), 4)) if pd.notna(perm_ml["P50"].iloc[i]) else None,
            "PERM_P90": safe_float(round(float(np.power(10.0, perm_ml["P90"].iloc[i])), 4)) if pd.notna(perm_ml["P90"].iloc[i]) else None,
            "LITHOLOGY": str(lith.iloc[i]),
            "CONFIDENCE": safe_float(round(float(confidence.iloc[i]), 2)) if pd.notna(confidence.iloc[i]) else None,
            "RELIABILITY": safe_float(round(float(reliability.iloc[i]), 2)) if pd.notna(reliability.iloc[i]) else None,
            "MODEL": model_display_name(ai_model) if use_ai else "Empirical",
            "SATURATION_METHOD": sat_label,
            "PERM_METHOD": "Timur",
        })

    def avg(key):
        values = [row.get(key) for row in records if row.get(key) is not None]
        return round(float(np.mean(values)), 4) if values else 0.0

    bundle = {
        "vsh": [{"DEPTH": r["DEPTH"], "GR": r["GR"], "IGR": r["IGR"], "VSH": r["VSH"], "VSH_P10": None, "VSH_P50": r["VSH"], "VSH_P90": None} for r in records],
        "porosity": [{"DEPTH": r["DEPTH"], "PHIT": r["PHIT"], "PHIE": r["PHIE"], "PHIT_P10": r["PHI_P10"], "PHIT_P50": r["PHI_P50"], "PHIT_P90": r["PHI_P90"]} for r in records],
        "saturation": [{"DEPTH": r["DEPTH"], "RT": r["RT"], "SW": r["SW"], "SW_P10": r["SW_P10"], "SW_P50": r["SW_P50"], "SW_P90": r["SW_P90"], "SATURATION_METHOD": r["SATURATION_METHOD"]} for r in records],
        "permeability": [{"DEPTH": r["DEPTH"], "PHIT": r["PHIT"], "PHIE": r["PHIE"], "SW": r["SW"], "PERM": r["PERM"], "PERM_METHOD": r["PERM_METHOD"]} for r in records],
        "lithology": [{"DEPTH": r["DEPTH"], "VSH": r["VSH"], "RHOB": None, "LITHOLOGY": r["LITHOLOGY"]} for r in records],
        "preview": records,
    }
    return to_builtin({
        "success": True,
        "records": records[:5],
        "all_records": records,
        "bundle": bundle,
        "vsh_table": bundle["vsh"],
        "porosity_table": bundle["porosity"],
        "saturation_table": bundle["saturation"],
        "permeability_table": bundle["permeability"],
        "lithology_table": bundle["lithology"],
        "exports": bundle,
        "active_formulas": {
            "vsh": vsh_label if not use_ai else model_display_name(ai_model),
            "porosity": model_display_name(ai_model) if use_ai else "Density Porosity",
            "saturation": f"{model_display_name(ai_model)} + {sat_label}" if use_ai else sat_label,
            "permeability": model_display_name(ai_model) if use_ai else "Timur",
        },
        "summary_cards": {
            "avg_phi_p50": avg("PHIE"),
            "avg_sw_p50": avg("SW"),
            "avg_perm_md": avg("PERMEABILITY_MD"),
            "avg_confidence": avg("CONFIDENCE"),
            "rows": len(records),
        },
    })

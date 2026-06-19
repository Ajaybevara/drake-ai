"""Drake uncertainty helper ported from the external module."""

import numpy as np
import pandas as pd


def build_prediction_bundle(item: dict):
    df = pd.DataFrame(item.get('logs_data', []))
    if df.empty:
        return {'porosity': [], 'saturation': [], 'lithology': [], 'preview': []}

    if 'DEPTH' not in df.columns:
        df['DEPTH'] = np.arange(len(df), dtype=float)

    depth = pd.to_numeric(df['DEPTH'], errors='coerce').ffill().bfill().fillna(0)
    log_names = item.get('log_names', [])

    available = [c for c in log_names if c in df.columns]
    primary = available[0] if available else None
    secondary = available[1] if len(available) > 1 else primary
    tertiary = available[2] if len(available) > 2 else primary

    base = pd.to_numeric(df[primary], errors='coerce').ffill().bfill() if primary else pd.Series(np.linspace(0, 1, len(df)))
    support = pd.to_numeric(df[secondary], errors='coerce').ffill().bfill() if secondary else base.copy()
    aux = pd.to_numeric(df[tertiary], errors='coerce').ffill().bfill() if tertiary else base.copy()

    base_norm = (base - base.min()) / (base.max() - base.min() + 1e-9)
    support_norm = (support - support.min()) / (support.max() - support.min() + 1e-9)
    aux_norm = (aux - aux.min()) / (aux.max() - aux.min() + 1e-9)

    porosity = (0.08 + 0.22 * (1 - base_norm) + 0.03 * np.sin(depth / 40.0) + 0.02 * (1 - support_norm)).clip(0.02, 0.38)
    sw = (0.18 + 0.68 * base_norm + 0.05 * np.cos(depth / 55.0) + 0.04 * aux_norm).clip(0.05, 0.98)
    spread = (0.03 + 0.06 * base_norm + 0.02 * np.abs(np.sin(depth / 60.0))).clip(0.03, 0.18)
    p10 = (sw - spread).clip(0.01, 0.98)
    p90 = (sw + spread).clip(0.02, 0.99)
    confidence = (97 - (base_norm * 22 + spread * 120)).clip(55, 98)
    reliability = (100 - spread * 180).clip(52, 98)
    lith = np.where(base_norm < 0.33, 'Clean Sand', np.where(base_norm < 0.66, 'Shaly Sand', 'Shale'))
    risk = np.where(reliability >= 85, 'Low', np.where(reliability >= 70, 'Medium', 'High'))

    porosity_rows = []
    saturation_rows = []
    lithology_rows = []
    preview_rows = []

    for i in range(len(df)):
        d = round(float(depth.iloc[i]), 2)
        por = round(float(porosity.iloc[i]), 4)
        sat = round(float(sw.iloc[i]) * 100, 2)
        p10v = round(float(p10.iloc[i]) * 100, 2)
        p90v = round(float(p90.iloc[i]) * 100, 2)
        conf = round(float(confidence.iloc[i]), 2)
        rel = round(float(reliability.iloc[i]), 2)
        lithology = str(lith[i])

        porosity_rows.append({'DEPTH': d, 'POROSITY': por, 'CONFIDENCE': conf})
        saturation_rows.append({'DEPTH': d, 'SW': sat, 'P10': p10v, 'P50': sat, 'P90': p90v, 'RELIABILITY': rel, 'RISK': str(risk[i])})
        lithology_rows.append({'DEPTH': d, 'LITHOLOGY': lithology, 'CONFIDENCE': conf})
        preview_rows.append({'DEPTH': d, 'POROSITY': por, 'WATER_SATURATION': sat, 'LITHOLOGY': lithology, 'CONFIDENCE': conf, 'P10': p10v, 'P50': sat, 'P90': p90v, 'RELIABILITY': rel, 'RISK': str(risk[i])})

    return {
        'porosity': porosity_rows,
        'saturation': saturation_rows,
        'lithology': lithology_rows,
        'preview': preview_rows,
    }


def _safe_float(value):
    try:
        if value is None:
            return None
        f = float(value)
        if np.isnan(f) or np.isinf(f):
            return None
        return f
    except Exception:
        return None


def _to_builtin(value):
    if isinstance(value, dict):
        return {str(k): _to_builtin(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_builtin(v) for v in value]
    if isinstance(value, tuple):
        return [_to_builtin(v) for v in value]
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        f = float(value)
        return None if np.isnan(f) or np.isinf(f) else f
    if isinstance(value, float):
        return None if np.isnan(value) or np.isinf(value) else value
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def find_log_name(log_names, candidates):
    upper_map = {str(name).upper(): name for name in (log_names or []) if str(name).upper() != 'DEPTH'}
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
            if key in log_key and len(key) >= 2:
                return original
    return None


def _clean_numeric(df, col):
    if not col or col not in df.columns:
        return pd.Series([np.nan] * len(df), index=df.index, dtype='float64')
    return pd.to_numeric(df[col], errors='coerce').replace([np.inf, -np.inf], np.nan).astype('float64')


def _prepare_item_frame(item):
    df = pd.DataFrame(item.get('logs_data', []))
    if df.empty:
        return df, []
    df.columns = [str(c).upper() for c in df.columns]
    if 'DEPTH' not in df.columns:
        df['DEPTH'] = np.arange(len(df), dtype=float)
    df['DEPTH'] = pd.to_numeric(df['DEPTH'], errors='coerce').ffill().bfill().fillna(0)
    log_names = [str(c).upper() for c in item.get('log_names', [])]
    if not log_names:
        log_names = [c for c in df.columns if c != 'DEPTH']
    return df, log_names


def predict_vsh(df, log_names):
    gr_col = find_log_name(log_names or list(df.columns), ['GRD', 'GR', 'GRS', 'GRR', 'CGR', 'SGR', 'HSGR', 'GRC', 'GAMMA', 'GAMMARAY'])
    gr = _clean_numeric(df, gr_col)
    valid = gr.dropna()
    if valid.empty:
        return pd.Series([np.nan] * len(df), index=df.index, dtype='float64')
    gr_min = float(valid.quantile(0.05))
    gr_max = float(valid.quantile(0.95))
    denom = gr_max - gr_min
    if denom == 0:
        return pd.Series([np.nan] * len(df), index=df.index, dtype='float64')
    return ((gr - gr_min) / denom).clip(0.0, 1.0).where(gr.notna(), other=np.nan).astype('float64')


def predict_porosity(df, log_names):
    rhob_col = find_log_name(log_names or list(df.columns), ['RHOB', 'RHOZ', 'DEN', 'ZDEN'])
    nphi_col = find_log_name(log_names or list(df.columns), ['NPHI', 'NPHIS', 'NPHISS', 'NPL', 'TNPH'])
    dt_col = find_log_name(log_names or list(df.columns), ['DT', 'DTP', 'AC', 'SONIC', 'DTCO'])

    phid = pd.Series([np.nan] * len(df), index=df.index, dtype='float64')
    if rhob_col:
        rhob = _clean_numeric(df, rhob_col).where(lambda s: (s >= 1.0) & (s <= 3.5))
        phid = ((2.65 - rhob) / (2.65 - 1.0)).clip(0.0, 1.0).where(rhob.notna(), other=np.nan)

    phin = pd.Series([np.nan] * len(df), index=df.index, dtype='float64')
    if nphi_col:
        phin = _clean_numeric(df, nphi_col)
        if phin.dropna().median() > 1.0:
            phin = phin / 100.0
        phin = phin.where((phin >= -0.15) & (phin <= 1.0)).clip(0.0, 1.0)

    phis = pd.Series([np.nan] * len(df), index=df.index, dtype='float64')
    if dt_col:
        dt = _clean_numeric(df, dt_col)
        phis = ((dt - 55.5) / (189.0 - 55.5)).clip(0.0, 1.0).where(dt.notna(), other=np.nan)

    both = phid.notna() & phin.notna()
    one_density = phid.notna() & phin.isna()
    one_neutron = phid.isna() & phin.notna()
    phit = pd.Series(np.nan, index=df.index, dtype='float64')
    phit[both] = np.sqrt((phid[both].values ** 2 + phin[both].values ** 2) / 2.0)
    phit[one_density] = phid[one_density]
    phit[one_neutron] = phin[one_neutron]
    phit[phit.isna() & phis.notna()] = phis[phit.isna() & phis.notna()]
    return phit.clip(0.0, 1.0)


def predict_saturation(df, log_names, phie):
    rt_col = find_log_name(log_names or list(df.columns), ['RT', 'RESD', 'ILD', 'LLD', 'AT90', 'HDRS', 'RDEP'])
    rt = _clean_numeric(df, rt_col).where(lambda s: s > 0)
    phie_safe = phie.where(phie > 0.001)
    sw = (((1.0 * 0.10) / ((phie_safe ** 2.0) * rt)) ** 0.5)
    return sw.replace([np.inf, -np.inf], np.nan).clip(0.0, 1.0).where(rt.notna() & phie.notna(), other=np.nan)


def predict_lithology(df, log_names, vsh, phie):
    rhob_col = find_log_name(log_names or list(df.columns), ['RHOB', 'RHOZ', 'DEN', 'ZDEN'])
    rhob = _clean_numeric(df, rhob_col)
    labels = []
    for idx in df.index:
        v = vsh.loc[idx]
        rho = rhob.loc[idx]
        phi = phie.loc[idx]
        if pd.notna(rho) and rho < 1.80:
            labels.append('Coal')
        elif pd.notna(rho) and 2.80 <= rho <= 2.90:
            labels.append('Dolomite')
        elif pd.notna(rho) and 2.68 <= rho <= 2.75:
            labels.append('Limestone')
        elif pd.notna(v) and v > 0.50:
            labels.append('Shale')
        elif pd.notna(v) and v > 0.30:
            labels.append('Shaly Sand')
        elif pd.notna(v) and v <= 0.30 and pd.notna(phi) and phi >= 0.10:
            labels.append('Clean Sandstone')
        else:
            labels.append('Unknown')
    return pd.Series(labels, index=df.index, dtype='object')


def calculate_uncertainty(p50, method='percent', uncertainty_value=0.03, pct=0.10):
    p50 = np.asarray(p50, dtype=float)
    nan_mask = np.isnan(p50)
    safe = np.where(nan_mask, 0.0, p50)
    if method == 'fixed':
        mean = float(np.nanmean(safe)) if np.nanmean(safe) > 0 else 0.15
        spread = float(uncertainty_value) * (1.0 + (np.abs(safe - mean) / (mean + 1e-6)))
    else:
        spread = safe * float(pct)
    return (
        np.where(nan_mask, np.nan, np.clip(p50 - spread, 0, 1)),
        np.where(nan_mask, np.nan, p50),
        np.where(nan_mask, np.nan, np.clip(p50 + spread, 0, 1)),
    )


def _interpret(p10, p50, p90, kind):
    p10 = np.asarray([np.nan if v is None else v for v in p10], dtype=float)
    p90 = np.asarray([np.nan if v is None else v for v in p90], dtype=float)
    spread = p90 - p10
    valid = ~np.isnan(spread)
    if not valid.any():
        return [f'No valid {kind} uncertainty data was computed for this well.']
    mean_spread = float(np.nanmean(spread[valid]))
    high_idx = int(np.nanargmax(spread))
    low_idx = int(np.nanargmin(spread))
    label = 'porosity' if kind == 'porosity' else 'water saturation'
    notes = [
        f'Average {label} uncertainty spread (P90-P10): {mean_spread:.4f}.',
        f'Highest uncertainty occurs near sample index {high_idx}; review input log quality or calibration there.',
        f'Lowest uncertainty occurs near sample index {low_idx}; this is the most stable part of the estimate.',
        'P50 is the best-estimate curve, while P10 and P90 are probabilistic bounds.',
    ]
    if kind == 'porosity' and mean_spread > 0.08:
        notes.append('Porosity uncertainty is wide; core or NMR calibration is recommended.')
    if kind == 'saturation' and mean_spread > 0.15:
        notes.append('Saturation uncertainty is wide; review Rw, cementation exponent, saturation exponent, and shaly-sand effects.')
    return notes


def compute_uncertainty_analysis(item: dict, payload: dict | None = None):
    payload = payload or {}
    df, log_names = _prepare_item_frame(item)
    if df.empty:
        return {'success': False, 'message': 'No log data available for this well.'}

    vsh = predict_vsh(df, log_names)
    phit = predict_porosity(df, log_names)
    phie = (phit * (1.0 - vsh.fillna(0.0))).where(phit.notna(), other=np.nan).clip(0.0, 1.0)
    sw = predict_saturation(df, log_names, phie)
    lithology = predict_lithology(df, log_names, vsh, phie)

    phi_method = str(payload.get('phi_method', 'percent')).lower()
    sw_method = str(payload.get('sw_method', 'percent')).lower()
    phi_p10, phi_p50, phi_p90 = calculate_uncertainty(
        phie.values,
        method=phi_method,
        uncertainty_value=float(payload.get('phi_unc', 0.03)),
        pct=float(payload.get('phi_pct', 0.12)),
    )
    sw_p10, sw_p50, sw_p90 = calculate_uncertainty(
        sw.values,
        method=sw_method,
        uncertainty_value=float(payload.get('sw_unc', 0.05)),
        pct=float(payload.get('sw_pct', 0.15)),
    )

    depth = pd.to_numeric(df['DEPTH'], errors='coerce').values
    records = []
    for i in range(len(df)):
        if _safe_float(depth[i]) is None:
            continue
        records.append({
            'DEPTH': round(float(depth[i]), 2),
            'VSH': _safe_float(round(float(vsh.iloc[i]), 5)) if pd.notna(vsh.iloc[i]) else None,
            'PHIT': _safe_float(round(float(phit.iloc[i]), 5)) if pd.notna(phit.iloc[i]) else None,
            'PHIE': _safe_float(round(float(phie.iloc[i]), 5)) if pd.notna(phie.iloc[i]) else None,
            'PHI_P10': _safe_float(round(float(phi_p10[i]), 5)) if not np.isnan(phi_p10[i]) else None,
            'PHI_P50': _safe_float(round(float(phi_p50[i]), 5)) if not np.isnan(phi_p50[i]) else None,
            'PHI_P90': _safe_float(round(float(phi_p90[i]), 5)) if not np.isnan(phi_p90[i]) else None,
            'PHI_UNCERTAINTY_SPREAD': _safe_float(round(float(phi_p90[i] - phi_p10[i]), 5)) if not (np.isnan(phi_p90[i]) or np.isnan(phi_p10[i])) else None,
            'SW': _safe_float(round(float(sw.iloc[i]), 5)) if pd.notna(sw.iloc[i]) else None,
            'SW_P10': _safe_float(round(float(sw_p10[i]), 5)) if not np.isnan(sw_p10[i]) else None,
            'SW_P50': _safe_float(round(float(sw_p50[i]), 5)) if not np.isnan(sw_p50[i]) else None,
            'SW_P90': _safe_float(round(float(sw_p90[i]), 5)) if not np.isnan(sw_p90[i]) else None,
            'SW_UNCERTAINTY_SPREAD': _safe_float(round(float(sw_p90[i] - sw_p10[i]), 5)) if not (np.isnan(sw_p90[i]) or np.isnan(sw_p10[i])) else None,
            'LITHOLOGY': str(lithology.iloc[i]),
        })

    records.sort(key=lambda row: row['DEPTH'])

    def _mean(values):
        arr = np.asarray([np.nan if v is None else v for v in values], dtype=float)
        return round(float(np.nanmean(arr)), 4) if not np.all(np.isnan(arr)) else 0.0

    phi_spreads = [r['PHI_UNCERTAINTY_SPREAD'] for r in records]
    sw_spreads = [r['SW_UNCERTAINTY_SPREAD'] for r in records]
    phi_valid = [(idx, val) for idx, val in enumerate(phi_spreads) if val is not None]
    sw_valid = [(idx, val) for idx, val in enumerate(sw_spreads) if val is not None]
    max_phi_idx = max(phi_valid, key=lambda item: item[1])[0] if phi_valid else None
    max_sw_idx = max(sw_valid, key=lambda item: item[1])[0] if sw_valid else None
    lith_counts = pd.Series([r['LITHOLOGY'] for r in records]).value_counts().to_dict()

    return _to_builtin({
        'success': True,
        'records': records[:5],
        'all_records': records,
        'phi_interp': _interpret([r['PHI_P10'] for r in records], [r['PHI_P50'] for r in records], [r['PHI_P90'] for r in records], 'porosity'),
        'sw_interp': _interpret([r['SW_P10'] for r in records], [r['SW_P50'] for r in records], [r['SW_P90'] for r in records], 'saturation'),
        'summary_cards': {
            'avg_phi_p50': _mean([r['PHI_P50'] for r in records]),
            'avg_phi_spread': _mean(phi_spreads),
            'avg_sw_p50': _mean([r['SW_P50'] for r in records]),
            'avg_sw_spread': _mean(sw_spreads),
            'max_phi_spread_depth': records[max_phi_idx]['DEPTH'] if max_phi_idx is not None else None,
            'max_sw_spread_depth': records[max_sw_idx]['DEPTH'] if max_sw_idx is not None else None,
            'lithology_counts': lith_counts,
            'rows': len(records),
        },
    })

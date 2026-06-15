"""Standalone Drake AI uncertainty engine integrated from uploaded Flask app."""

from __future__ import annotations

import numpy as np

from app.ml.drake_prediction_standalone import compute_prediction_sections, safe_float, to_builtin


def calculate_porosity_uncertainty(phi_p50, method="fixed", uncertainty_value=0.03, pct=0.10):
    p50 = np.asarray([np.nan if v is None else v for v in phi_p50], dtype=float)
    nan_mask = np.isnan(p50)
    safe = np.where(nan_mask, 0.0, p50)
    if str(method).lower() == "fixed":
        mean = float(np.nanmean(safe)) if np.nanmean(safe) > 0 else 0.15
        spread = float(uncertainty_value) * (1.0 + (np.abs(safe - mean) / (mean + 1e-6)))
    else:
        spread = safe * float(pct)
    return (
        np.where(nan_mask, np.nan, np.clip(p50 - spread, 0, 1)),
        np.where(nan_mask, np.nan, p50),
        np.where(nan_mask, np.nan, np.clip(p50 + spread, 0, 1)),
    )


def calculate_saturation_uncertainty(sw_p50, method="fixed", uncertainty_value=0.05, pct=0.10):
    p50 = np.asarray([np.nan if v is None else v for v in sw_p50], dtype=float)
    nan_mask = np.isnan(p50)
    safe = np.where(nan_mask, 0.0, p50)
    if str(method).lower() == "fixed":
        mean = float(np.nanmean(safe)) if np.nanmean(safe) > 0 else 0.5
        spread = float(uncertainty_value) * (1.0 + (np.abs(safe - mean) / (mean + 1e-6)))
    else:
        spread = safe * float(pct)
    return (
        np.where(nan_mask, np.nan, np.clip(p50 - spread, 0, 1)),
        np.where(nan_mask, np.nan, p50),
        np.where(nan_mask, np.nan, np.clip(p50 + spread, 0, 1)),
    )


def interpret_uncertainty_results(p10_arr, p50_arr, p90_arr, kind="porosity"):
    p10 = np.asarray([np.nan if v is None else v for v in p10_arr], dtype=float)
    p90 = np.asarray([np.nan if v is None else v for v in p90_arr], dtype=float)
    spread = p90 - p10
    valid = ~np.isnan(spread)
    if not valid.any():
        return [f"No valid {kind} uncertainty data was computed for this well."]
    mean_spread = float(np.nanmean(spread[valid]))
    high_idx = int(np.nanargmax(spread))
    low_idx = int(np.nanargmin(spread))
    label = "porosity" if kind == "porosity" else "water saturation"
    notes = [
        f"Average {label} uncertainty spread (P90-P10): {mean_spread:.4f}.",
        f"Highest uncertainty occurs near sample index {high_idx}; review input log quality or calibration there.",
        f"Lowest uncertainty occurs near sample index {low_idx}; this is the most stable part of the estimate.",
        "P50 is the best-estimate curve, while P10 and P90 are probabilistic bounds.",
    ]
    if kind == "porosity" and mean_spread > 0.08:
        notes.append("Porosity uncertainty is wide; core or NMR calibration is recommended.")
    if kind == "saturation" and mean_spread > 0.15:
        notes.append("Saturation uncertainty is wide; review Rw, cementation exponent, saturation exponent, and shaly-sand effects.")
    return notes


def compute_uncertainty_sections(item, payload=None):
    payload = payload or {}
    prediction = compute_prediction_sections(item, payload)
    if not prediction.get("success"):
        return prediction
    base_records = prediction.get("all_records", [])
    phi_values = [row.get("PHIE") for row in base_records]
    sw_values = [row.get("SW") for row in base_records]
    phi_p10, phi_p50, phi_p90 = calculate_porosity_uncertainty(
        phi_values,
        method=payload.get("phi_method", "fixed"),
        uncertainty_value=float(payload.get("phi_unc", 0.03)),
        pct=float(payload.get("phi_pct", 0.10)),
    )
    sw_p10, sw_p50, sw_p90 = calculate_saturation_uncertainty(
        sw_values,
        method=payload.get("sw_method", "fixed"),
        uncertainty_value=float(payload.get("sw_unc", 0.05)),
        pct=float(payload.get("sw_pct", 0.10)),
    )
    records = []
    for i, row in enumerate(base_records):
        records.append({
            **row,
            "PHI_P10": safe_float(round(float(phi_p10[i]), 5)) if not np.isnan(phi_p10[i]) else None,
            "PHI_P50": safe_float(round(float(phi_p50[i]), 5)) if not np.isnan(phi_p50[i]) else None,
            "PHI_P90": safe_float(round(float(phi_p90[i]), 5)) if not np.isnan(phi_p90[i]) else None,
            "PHI_UNCERTAINTY_SPREAD": safe_float(round(float(phi_p90[i] - phi_p10[i]), 5)) if not (np.isnan(phi_p90[i]) or np.isnan(phi_p10[i])) else None,
            "SW_P10": safe_float(round(float(sw_p10[i]), 5)) if not np.isnan(sw_p10[i]) else None,
            "SW_P50": safe_float(round(float(sw_p50[i]), 5)) if not np.isnan(sw_p50[i]) else None,
            "SW_P90": safe_float(round(float(sw_p90[i]), 5)) if not np.isnan(sw_p90[i]) else None,
            "SW_UNCERTAINTY_SPREAD": safe_float(round(float(sw_p90[i] - sw_p10[i]), 5)) if not (np.isnan(sw_p90[i]) or np.isnan(sw_p10[i])) else None,
        })

    def avg(key):
        values = [row.get(key) for row in records if row.get(key) is not None]
        return round(float(np.mean(values)), 4) if values else 0.0

    return to_builtin({
        "success": True,
        "records": records[:5],
        "all_records": records,
        "phi_interp": interpret_uncertainty_results([r.get("PHI_P10") for r in records], [r.get("PHI_P50") for r in records], [r.get("PHI_P90") for r in records], "porosity"),
        "sw_interp": interpret_uncertainty_results([r.get("SW_P10") for r in records], [r.get("SW_P50") for r in records], [r.get("SW_P90") for r in records], "saturation"),
        "summary_cards": {
            "avg_phi_p50": avg("PHI_P50"),
            "avg_phi_spread": avg("PHI_UNCERTAINTY_SPREAD"),
            "avg_sw_p50": avg("SW_P50"),
            "avg_sw_spread": avg("SW_UNCERTAINTY_SPREAD"),
            "avg_perm_md": avg("PERMEABILITY_MD"),
            "rows": len(records),
        },
        "prediction": prediction,
    })

from __future__ import annotations

import io
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

CURVE_ALIASES = {
    "depth": ["DEPT", "DEPTH", "MD", "TVD"],
    "temp": ["TEMP", "TEMP_C", "TEMPC", "BHT", "TTEMP"],
    "gr": ["GR", "GR_API", "GAMMA", "CGR", "SGR"],
    "res": ["RT", "RES", "RESIST", "RDEEP", "ILD", "LLD", "LLS", "RILD"],
    "rhob": ["RHOB", "DEN", "DENS", "DENSITY"],
    "nphi": ["NPHI", "PHIN", "NEUT"],
    "dt": ["DT", "DTC", "AC", "SONIC"],
    "perm": ["PERM", "K", "KLOG", "PERM_MD"],
    "vsh": ["VSH", "VCL", "VCLAY", "SHALE"],
    "phi": ["PHI", "PHIE", "PHIT", "POR", "PORO"],
}

DISPLAY_NAMES = {
    "depth_m": "Measured Depth",
    "temp_c": "Temperature",
    "gradient_c_km": "Geothermal Gradient",
    "gr_api": "Gamma Ray",
    "res_ohmm": "Deep Resistivity",
    "rhob_gcc": "Bulk Density",
    "nphi_frac": "Neutron Porosity",
    "dt_usft": "Compressional Sonic",
    "vsh_frac": "Shale Volume",
    "porosity_frac": "Effective Porosity",
    "perm_md": "Estimated Permeability",
    "rq_score": "Reservoir Quality Index",
    "hot_zone_score": "Geothermal Target Score",
    "heat_flow_mwm2": "Estimated Heat Flow",
    "thermal_index": "Thermal Potential Index",
}

UNITS = {
    "depth_m": "m",
    "temp_c": "degC",
    "gradient_c_km": "degC/km",
    "gr_api": "API",
    "res_ohmm": "ohm.m",
    "rhob_gcc": "g/cc",
    "nphi_frac": "v/v",
    "dt_usft": "us/ft",
    "vsh_frac": "v/v",
    "porosity_frac": "v/v",
    "perm_md": "mD",
    "rq_score": "0-100",
    "hot_zone_score": "0-100",
    "heat_flow_mwm2": "mW/m2",
    "thermal_index": "0-100",
}


def parse_header_line(line: str):
    text = line.strip()
    if not text or text.startswith("#") or "." not in text:
        return None
    left, desc = (text.split(":", 1) + [""])[:2] if ":" in text else (text, "")
    mnemonic, rest = left.split(".", 1)
    parts = rest.strip().split()
    unit = parts[0] if len(parts) > 1 else ""
    value = " ".join(parts[1:]) if len(parts) > 1 else (parts[0] if parts else "")
    return mnemonic.strip().upper(), unit.strip(), value.strip(), desc.strip()


def clean_float(value):
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        val = float(match.group(0))
    except ValueError:
        return None
    upper = text.upper()
    if any(item in upper for item in [" S", "SOUTH"]) and val > 0:
        val *= -1
    if any(item in upper for item in [" W", "WEST"]) and val > 0:
        val *= -1
    return val


def extract_location(headers):
    lat_keys = ["LAT", "LATI", "LATITUDE", "SLAT", "WELL_LATITUDE"]
    lon_keys = ["LON", "LONG", "LONGI", "LONGITUDE", "SLON", "WELL_LONGITUDE"]
    lat = next((clean_float(headers.get(key)) for key in lat_keys if clean_float(headers.get(key)) is not None), None)
    lon = next((clean_float(headers.get(key)) for key in lon_keys if clean_float(headers.get(key)) is not None), None)
    if lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180:
        return {"lat": round(lat, 7), "lon": round(lon, 7), "available": True}
    return {"lat": None, "lon": None, "available": False}


def find_col(cols, key):
    upper = {str(c).upper(): c for c in cols}
    for alias in CURVE_ALIASES[key]:
        if alias in upper:
            return upper[alias]
    for col in cols:
        col_upper = str(col).upper()
        if any(alias in col_upper for alias in CURVE_ALIASES[key]):
            return col
    return None


def parse_las_bytes(filename: str, content: bytes):
    curves, headers, data = [], {}, []
    null_value = -999.25
    in_curve = False
    in_ascii = False
    text = content.decode("utf-8", errors="ignore")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        upper = line.upper()
        if upper.startswith("~CURVE") or upper.startswith("~C"):
            in_curve, in_ascii = True, False
            continue
        if upper.startswith("~A") or upper.startswith("~OTHER"):
            in_curve, in_ascii = False, True
            continue
        if upper.startswith("~"):
            in_curve, in_ascii = False, False
            continue
        if in_curve:
            parsed = parse_header_line(line)
            if parsed:
                curves.append(parsed[0])
            continue
        if in_ascii:
            parts = line.split()
            if any(re.search(r"[A-Za-z]", part) for part in parts):
                if not curves:
                    curves = [part.upper() for part in parts]
                continue
            try:
                data.append([float(value) for value in parts])
            except ValueError:
                continue
            continue
        parsed = parse_header_line(line)
        if parsed:
            key, _, value, _ = parsed
            headers[key] = value
            if key == "NULL":
                try:
                    null_value = float(value)
                except ValueError:
                    pass
    if not data:
        raise ValueError("No LAS ASCII data section was found.")
    width = max(len(row) for row in data)
    if len(curves) < width:
        curves = (curves + [f"CURVE_{index + 1}" for index in range(width)])[:width]
    rows = [(row + [np.nan] * width)[:width] for row in data]
    df = pd.DataFrame(rows, columns=curves[:width]).replace([null_value, -999.25, -9999.25, -999.0], np.nan)
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    depth_col = find_col(df.columns, "depth") or df.columns[0]
    out = pd.DataFrame({"depth_m": df[depth_col]})
    sources = {"depth_m": {"source": depth_col, "method": "LAS curve"}}
    mapping = {
        "temp": "temp_c",
        "gr": "gr_api",
        "res": "res_ohmm",
        "rhob": "rhob_gcc",
        "nphi": "nphi_frac",
        "dt": "dt_usft",
        "vsh": "vsh_frac",
        "phi": "porosity_frac",
        "perm": "perm_md",
    }
    for key, target in mapping.items():
        col = find_col(df.columns, key)
        if col is not None and col != depth_col:
            out[target] = df[col]
            sources[target] = {"source": col, "method": "LAS curve"}
    out = out.dropna(subset=["depth_m"]).sort_values("depth_m").reset_index(drop=True)
    if out.empty:
        raise ValueError("LAS depth curve could not be parsed.")
    if "temp_c" not in out:
        total_depth = float(out.depth_m.max())
        bht = clean_float(headers.get("BHT") or headers.get("TEMP")) or 180.0
        surface = clean_float(headers.get("STEMP") or headers.get("SURF")) or 15.0
        out["temp_c"] = surface + (out.depth_m / max(total_depth, 1.0)) * (bht - surface)
        sources["temp_c"] = {"source": "BHT/header + depth", "method": "Estimated linear temperature profile; no LAS temperature curve found"}
    headers.setdefault("WELL", Path(filename).stem)
    return headers, out, sources


def normalize(series, lo=None, hi=None, invert=False):
    s = pd.to_numeric(series, errors="coerce")
    if lo is None:
        lo = float(np.nanpercentile(s, 5)) if s.notna().any() else 0.0
    if hi is None:
        hi = float(np.nanpercentile(s, 95)) if s.notna().any() else 1.0
    val = ((s - lo) / max(hi - lo, 1e-9)).clip(0, 1)
    return 1 - val if invert else val


def add_geothermal_metrics(df: pd.DataFrame, sources: dict):
    work = df.copy().sort_values("depth_m").reset_index(drop=True)
    depth = work.depth_m.to_numpy(float)
    temp = pd.to_numeric(work.temp_c, errors="coerce").interpolate(limit_direction="both")
    smooth_temp = temp.rolling(11, center=True, min_periods=1).median().rolling(9, center=True, min_periods=1).mean()
    grad = np.gradient(smooth_temp.to_numpy(float), depth) * 1000.0 if len(work) > 2 else np.zeros(len(work))
    work["temp_c"] = temp
    work["gradient_c_km"] = pd.Series(grad).replace([np.inf, -np.inf], np.nan).rolling(15, center=True, min_periods=1).median()
    sources["gradient_c_km"] = {"source": "Temperature + depth", "method": "Computed dT/dz from smoothed LAS temperature"}

    if "vsh_frac" not in work:
        if "gr_api" in work and work.gr_api.notna().sum() > 5:
            gr_clean = pd.to_numeric(work.gr_api, errors="coerce")
            gmin, gmax = np.nanpercentile(gr_clean, [5, 95])
            work["vsh_frac"] = ((gr_clean - gmin) / max(gmax - gmin, 1e-9)).clip(0, 1)
            sources["vsh_frac"] = {"source": "Gamma Ray", "method": "Larionov-style normalized GR shale index"}
        else:
            work["vsh_frac"] = np.nan
            sources["vsh_frac"] = {"source": "Unavailable", "method": "No GR/Vsh curve available"}
    elif work.vsh_frac.max(skipna=True) > 1.5:
        work["vsh_frac"] = (work.vsh_frac / 100.0).clip(0, 1)

    if "porosity_frac" not in work:
        por = None
        if "nphi_frac" in work and work.nphi_frac.notna().sum() > 5:
            por = pd.to_numeric(work.nphi_frac, errors="coerce")
            if por.max(skipna=True) > 1.5:
                por = por / 100.0
            sources["porosity_frac"] = {"source": "Neutron Porosity", "method": "Direct NPHI curve normalized to fraction"}
        elif "rhob_gcc" in work and work.rhob_gcc.notna().sum() > 5:
            por = ((2.65 - work.rhob_gcc) / (2.65 - 1.0)).clip(0, 0.35)
            sources["porosity_frac"] = {"source": "Bulk Density", "method": "Density porosity using matrix 2.65 g/cc and fluid 1.0 g/cc"}
        elif "dt_usft" in work and work.dt_usft.notna().sum() > 5:
            por = ((work.dt_usft - 55.5) / (189 - 55.5)).clip(0, 0.35)
            sources["porosity_frac"] = {"source": "Sonic", "method": "Wyllie time-average porosity estimate"}
        work["porosity_frac"] = por if por is not None else np.nan
        if por is None:
            sources["porosity_frac"] = {"source": "Unavailable", "method": "No porosity, density, neutron, or sonic curve available"}
    elif work.porosity_frac.max(skipna=True) > 1.5:
        work["porosity_frac"] = (work.porosity_frac / 100.0).clip(0, 0.5)

    vsh_for_calc = work.vsh_frac.fillna(0.35).clip(0, 1)
    phi_for_calc = work.porosity_frac.fillna(0.08).clip(0.01, 0.35)
    if "perm_md" not in work:
        shale_factor = (1 - vsh_for_calc).clip(0.05, 1)
        res_curve = pd.to_numeric(work.get("res_ohmm", pd.Series(10, index=work.index)), errors="coerce").fillna(10).clip(0.1, 1000)
        res_factor = normalize(np.log10(res_curve), invert=False)
        work["perm_md"] = (1200 * (phi_for_calc ** 3) / ((1 - phi_for_calc) ** 2) * shale_factor * (0.65 + 0.7 * res_factor)).clip(0.01, 1000)
        sources["perm_md"] = {"source": "Porosity + Vsh + resistivity support", "method": "Kozeny-Carman style permeability index calibrated for screening"}

    temp_score = normalize(work.temp_c, 90, 220)
    depth_score = normalize(work.depth_m, 900, 3500)
    phi_score = normalize(phi_for_calc, 0.04, 0.18)
    perm_score = normalize(np.log10(work.perm_md.clip(0.01, 1000)), -1, 2)
    clean_score = normalize(vsh_for_calc, 0.15, 0.55, invert=True)
    res_support = normalize(work.get("res_ohmm", pd.Series(10, index=work.index)).fillna(10), 1, 80)
    rq = (0.38 * phi_score + 0.32 * perm_score + 0.2 * clean_score + 0.1 * res_support).clip(0, 1)
    work["rq_score"] = (rq * 100).round(1)
    work["hot_zone_score"] = ((0.34 * temp_score + 0.2 * depth_score + 0.22 * phi_score + 0.14 * perm_score + 0.1 * clean_score) * 100).round(1)
    thermal_conductivity = 2.45 + 0.45 * clean_score - 0.25 * vsh_for_calc
    work["heat_flow_mwm2"] = (thermal_conductivity * work.gradient_c_km).clip(lower=0).round(1)
    heat_score = normalize(work.heat_flow_mwm2, 60, 180)
    work["thermal_index"] = (100 * (0.62 * heat_score + 0.38 * temp_score)).round(1)
    for col, method in [
        ("rq_score", "Weighted porosity, permeability, cleanliness, and resistivity"),
        ("hot_zone_score", "Weighted heat, depth, porosity, permeability, and cleanliness"),
        ("heat_flow_mwm2", "Thermal conductivity estimate x geothermal gradient"),
        ("thermal_index", "Heat-flow and temperature potential index"),
    ]:
        sources[col] = {"source": "Calculated from LAS-derived parameters", "method": method}
    return work.replace([np.inf, -np.inf], np.nan), sources


def interval_table(work: pd.DataFrame, score_col: str, min_score: float, label: str):
    mask = work[score_col].fillna(0) >= min_score
    intervals, start = [], None
    for i, ok in enumerate(mask):
        if ok and start is None:
            start = i
        if start is not None and ((not ok) or i == len(mask) - 1):
            end = i if ok and i == len(mask) - 1 else i - 1
            chunk = work.iloc[start:end + 1]
            if len(chunk) >= 3 and chunk.depth_m.max() - chunk.depth_m.min() >= 10:
                intervals.append({
                    "zone": label,
                    "top_m": round(float(chunk.depth_m.min()), 1),
                    "base_m": round(float(chunk.depth_m.max()), 1),
                    "thickness_m": round(float(chunk.depth_m.max() - chunk.depth_m.min()), 1),
                    "avg_temp_c": round(float(chunk.temp_c.mean()), 1),
                    "avg_gradient_c_km": round(float(chunk.gradient_c_km.mean()), 1),
                    "avg_vsh": round(float(chunk.vsh_frac.mean()), 3) if chunk.vsh_frac.notna().any() else None,
                    "avg_porosity_pct": round(float(chunk.porosity_frac.mean() * 100), 1) if chunk.porosity_frac.notna().any() else None,
                    "avg_perm_md": round(float(chunk.perm_md.mean()), 1),
                    "avg_heat_flow_mwm2": round(float(chunk.heat_flow_mwm2.mean()), 1),
                    "reservoir_quality": round(float(chunk.rq_score.mean()), 1),
                    "score": round(float(chunk[score_col].mean()), 1),
                })
            start = None
    return sorted(intervals, key=lambda item: item["score"], reverse=True)[:8]


def downsample(work, n=1400):
    return work if len(work) <= n else work.iloc[np.linspace(0, len(work) - 1, n).astype(int)]


def zone_flags(work, hot_zones, rq_zones):
    out = work.copy()
    out["in_hot_zone"] = False
    out["in_reservoir_quality_zone"] = False
    for zone in hot_zones:
        out.loc[(out.depth_m >= zone["top_m"]) & (out.depth_m <= zone["base_m"]), "in_hot_zone"] = True
    for zone in rq_zones:
        out.loc[(out.depth_m >= zone["top_m"]) & (out.depth_m <= zone["base_m"]), "in_reservoir_quality_zone"] = True
    return out


def section_payloads(work, hot, rq, plays, location):
    reservoir_cols = ["depth_m", "vsh_frac", "porosity_frac", "perm_md", "res_ohmm", "rq_score", "in_reservoir_quality_zone"]
    thermal_cols = ["depth_m", "temp_c", "gradient_c_km", "heat_flow_mwm2", "thermal_index", "in_hot_zone"]
    return {
        "visualization": work.to_dict(orient="records"),
        "gradient": work[["depth_m", "temp_c", "gradient_c_km", "in_hot_zone"]].to_dict(orient="records"),
        "hot_zones": hot,
        "reservoir_parameters": work[[col for col in reservoir_cols if col in work.columns]].to_dict(orient="records"),
        "reservoir_quality": rq,
        "thermal_potential": work[[col for col in thermal_cols if col in work.columns]].to_dict(orient="records"),
        "play_ranking": plays,
        "map": [
            {
                "latitude": location.get("lat"),
                "longitude": location.get("lon"),
                "depth_m": round(float(row.depth_m), 3),
                "heat_flow_mwm2": round(float(row.heat_flow_mwm2), 3),
                "temperature_c": round(float(row.temp_c), 3),
            }
            for _, row in downsample(work, 400).iterrows()
        ] if location.get("available") else [],
    }


def summarize(work: pd.DataFrame, filename: str, headers: dict, sources: dict):
    total_depth = round(float(work.depth_m.max()), 1)
    bht = round(float(work.loc[work.depth_m.idxmax(), "temp_c"]), 1)
    grad = round(float((bht - float(work.temp_c.iloc[0])) / max(total_depth - float(work.depth_m.iloc[0]), 1) * 1000), 1)
    hot = interval_table(work, "hot_zone_score", 52, "Best geothermal target")
    rq = interval_table(work, "rq_score", 40, "Reservoir quality interval")
    plays = []
    candidates = hot or rq or interval_table(work, "thermal_index", 60, "Thermal interval")
    for index, zone in enumerate(candidates[:5], start=1):
        temp_component = normalize(pd.Series([zone.get("avg_temp_c", 0)]), 90, 220).iloc[0] * 100
        score = round(0.45 * zone.get("score", 0) + 0.3 * zone.get("reservoir_quality", 0) + 0.25 * temp_component, 1)
        plays.append({**zone, "rank": index, "play_score": score, "decision": "Drill-ready target" if score >= 75 else "Appraise / validate" if score >= 60 else "Secondary lead"})
    work = zone_flags(work, hot, rq)
    location = extract_location(headers)
    curves = [col for col in work.columns if col not in ["in_hot_zone", "in_reservoir_quality_zone"]]
    stats = []
    for col in curves:
        series = pd.to_numeric(work[col], errors="coerce").dropna()
        stats.append({
            "curve": col,
            "name": DISPLAY_NAMES.get(col, col),
            "unit": UNITS.get(col, ""),
            "samples": int(series.size),
            "min": None if series.empty else round(float(series.min()), 4),
            "max": None if series.empty else round(float(series.max()), 4),
            "mean": None if series.empty else round(float(series.mean()), 4),
            "source": sources.get(col, {}).get("source", ""),
            "method": sources.get(col, {}).get("method", ""),
        })
    profile = downsample(work).round(4).replace({np.nan: None}).to_dict(orient="records")
    clean = work.round(4).replace({np.nan: None})
    sections = section_payloads(clean, hot, rq, sorted(plays, key=lambda item: item["play_score"], reverse=True), location)
    return {
        "filename": filename,
        "well_name": headers.get("WELL") or Path(filename).stem,
        "rows": int(len(work)),
        "td_m": total_depth,
        "bht_c": bht,
        "geothermal_gradient_c_km": grad,
        "location": location,
        "curve_display": [{"key": col, "name": DISPLAY_NAMES.get(col, col), "unit": UNITS.get(col, ""), **sources.get(col, {})} for col in curves],
        "curve_stats": stats,
        "hot_zones": hot,
        "reservoir_quality_zones": rq,
        "play_ranking": sorted(plays, key=lambda item: item["play_score"], reverse=True),
        "summary": {
            "max_temp_c": round(float(work.temp_c.max()), 1),
            "avg_heat_flow_mwm2": round(float(work.heat_flow_mwm2.mean()), 1),
            "max_heat_flow_mwm2": round(float(work.heat_flow_mwm2.max()), 1),
            "best_target": hot[0] if hot else None,
            "temp_note": sources.get("temp_c", {}).get("method", ""),
        },
        "profile": profile,
        "sections": sections,
    }


def analyze_geothermal_las(filename: str, content: bytes):
    headers, raw, sources = parse_las_bytes(filename, content)
    work, sources = add_geothermal_metrics(raw, sources)
    result = summarize(work, filename, headers, sources)
    flagged = zone_flags(work, result["hot_zones"], result["reservoir_quality_zones"])
    return result, flagged


def dataframe_to_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8")


def result_to_json_bytes(result: dict) -> bytes:
    return json.dumps(result, indent=2).encode("utf-8")


def heat_flow_map_png(result: dict, df: pd.DataFrame) -> bytes:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    data = df.copy().sort_values("depth_m")
    loc = result.get("location", {})
    well = result.get("well_name", "Uploaded LAS")
    fig, axes = plt.subplots(1, 2, figsize=(11, 5.8), gridspec_kw={"width_ratios": [1, 1.35]})
    fig.patch.set_facecolor("#07101d")
    for ax in axes:
        ax.set_facecolor("#f8fbff")
        ax.tick_params(colors="#334155", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#94a3b8")
    ax0, ax1 = axes
    if loc.get("available"):
        lat, lon = loc["lat"], loc["lon"]
        pad = 0.04
        ax0.scatter([lon], [lat], s=220, c=[float(data["heat_flow_mwm2"].max())], cmap="inferno", edgecolor="#0f172a", linewidth=1.2)
        ax0.set_xlim(lon - pad, lon + pad)
        ax0.set_ylim(lat - pad, lat + pad)
        ax0.set_xlabel("Longitude")
        ax0.set_ylabel("Latitude")
        ax0.set_title("LAS Header Location", fontsize=11, fontweight="bold", color="#0f172a")
        ax0.grid(True, color="#dbe5ef", linewidth=0.8)
        ax0.annotate(f"{well}\n{lat:.5f}, {lon:.5f}", (lon, lat), xytext=(8, 8), textcoords="offset points", fontsize=8, color="#0f172a")
    else:
        ax0.axis("off")
        ax0.text(0.5, 0.56, "No latitude / longitude in LAS header", ha="center", va="center", fontsize=12, fontweight="bold", color="#0f172a")
        ax0.text(0.5, 0.44, "Map activates when LAT/LON or LATITUDE/LONGITUDE headers are present.", ha="center", va="center", fontsize=9, color="#475569", wrap=True)
    scatter = ax1.scatter(data["heat_flow_mwm2"], data["depth_m"], c=data["temp_c"], cmap="inferno", s=18, alpha=0.9, edgecolors="none")
    ax1.invert_yaxis()
    ax1.set_xlabel("Estimated Heat Flow (mW/m2)")
    ax1.set_ylabel("Measured Depth (m)")
    ax1.set_title("Heat Flow vs Depth Colored by Temperature", fontsize=11, fontweight="bold", color="#0f172a")
    ax1.grid(True, color="#dbe5ef", linewidth=0.8)
    for zone in result.get("hot_zones", []):
        ax1.axhspan(zone["top_m"], zone["base_m"], color="#ef4444", alpha=0.14)
    cbar = fig.colorbar(scatter, ax=ax1, fraction=0.046, pad=0.04)
    cbar.set_label("Temperature (degC)", color="#334155")
    cbar.ax.tick_params(colors="#334155", labelsize=8)
    fig.suptitle("Drake AI Geothermal Heat-Flow Map", color="#f8fafc", fontsize=14, fontweight="bold")
    fig.tight_layout(rect=[0, 0, 1, 0.94])
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=180, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()

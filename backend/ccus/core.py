import html
import json
import math
import random
import re
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

NULLS = {-999.25, -999.0, -9999.0, -99999.0, -999.2500}

ALIASES = {
    "GR": ["GR", "GRD", "GRS", "CGR", "SGR", "GAMMA", "GAMMARAY"],
    "RHOB": ["RHOB", "RHOZ", "DEN", "ZDEN", "DENS", "RHO"],
    "NPHI": ["NPHI", "NPHIS", "NPHISS", "NPL", "TNPH", "NPOR"],
    "RT": ["RT", "RESD", "ILD", "LLD", "AT90", "RDEP", "RES", "LL8"],
    "DT": ["DT", "DTC", "DTP", "AC", "SONIC", "DTCO"],
    "PERM": ["PERM", "K", "KINT", "PERMEABILITY"],
    "PHIE": ["PHIE", "POR", "POR_E", "PHIT", "DPHI"],
    "VSH": ["VSH", "VCL", "VCLAY"],
}


def to_float(value):
    try:
        if value is None:
            return None
        v = float(str(value).strip())
        if math.isnan(v) or any(abs(v - n) < 1e-7 for n in NULLS):
            return None
        return v
    except Exception:
        return None


def safe_float(value, default):
    try:
        if value in (None, ""):
            return default
        return float(value)
    except Exception:
        return default


def percentile(values, pct, default=0.0):
    vals = sorted([v for v in values if v is not None and not math.isnan(v)])
    if not vals:
        return default
    if len(vals) == 1:
        return vals[0]
    k = (len(vals) - 1) * pct / 100.0
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return vals[int(k)]
    return vals[f] * (c - k) + vals[c] * (k - f)


def mean(values, default=None):
    vals = [v for v in values if v is not None and not math.isnan(v)]
    return sum(vals) / len(vals) if vals else default


def clamp(value, lo, hi):
    if value is None or math.isnan(value):
        return None
    return max(lo, min(hi, value))


def clean_mnemonic(token):
    token = token.strip().upper()
    token = token.split(".")[0].strip()
    return re.sub(r"[^A-Z0-9_]+", "", token)


def parse_header_line(line):
    if ":" not in line:
        return None, None, None
    left, _desc = line.split(":", 1)
    if not left.strip() or left.lstrip().startswith("#") or "." not in left:
        return None, None, None
    mnemonic_part, rest = left.split(".", 1)
    mnemonic = clean_mnemonic(mnemonic_part)
    if not mnemonic:
        return None, None, None
    if rest.startswith(" ") or rest.startswith("\t"):
        return mnemonic, "", rest.strip()
    bits = rest.strip().split(None, 1)
    unit = bits[0].strip() if bits else ""
    value = bits[1].strip() if len(bits) > 1 else ""
    return mnemonic, unit, value


def is_numeric_row(line):
    parts = line.split()
    if len(parts) < 2:
        return False
    return all(
        to_float(p) is not None or any(abs(float(p) - n) < 1e-7 for n in NULLS)
        for p in parts
        if re.match(r"^[+-]?(\d+(\.\d*)?|\.\d+)([Ee][+-]?\d+)?$", p)
    )


def detect_header_tokens(line):
    tokens = [clean_mnemonic(t) for t in line.split()]
    tokens = [t for t in tokens if t]
    if len(tokens) >= 2 and tokens[0] in {"DEPT", "DEPTH", "MD"}:
        return tokens
    return None


def parse_las_text(path):
    text = Path(path).read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    curves = []
    units = {}
    meta = {}
    data_rows = []
    section = ""
    ascii_mode = False
    data_columns = []

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        upper = line.upper()
        if upper.startswith("~"):
            section = upper
            ascii_mode = upper.startswith("~A")
            continue
        if line.startswith("#"):
            continue
        if section.startswith("~W") or section.startswith("~P"):
            mnemonic, unit, value = parse_header_line(line)
            if mnemonic:
                meta[mnemonic] = value if value else "N/A"
                if mnemonic == "NULL":
                    null_val = to_float(value)
                    if null_val is not None:
                        NULLS.add(null_val)
            continue
        if section.startswith("~C"):
            mnemonic, unit, _value = parse_header_line(line)
            if mnemonic and mnemonic not in curves:
                curves.append(mnemonic)
                units[mnemonic] = unit
            continue
        header_tokens = detect_header_tokens(line)
        if header_tokens and not is_numeric_row(line):
            data_columns = header_tokens
            ascii_mode = True
            if not curves:
                curves = data_columns[:]
                for c in curves:
                    units.setdefault(c, "")
            continue
        if ascii_mode or section.startswith("~O"):
            if is_numeric_row(line):
                nums = [to_float(x) for x in line.split()]
                cols = data_columns or curves
                if not cols and len(nums) > 1:
                    cols = ["DEPT"] + [f"CURVE_{i}" for i in range(1, len(nums))]
                    curves = cols[:]
                if cols and len(nums) >= len(cols):
                    row = {}
                    for idx, name in enumerate(cols):
                        row[clean_mnemonic(name)] = nums[idx]
                    data_rows.append(row)

    if not data_rows:
        raise ValueError("No numeric log data found. The LAS may be wrapped, encrypted, or not standard LAS ASCII.")

    depth_candidates = ["DEPT", "DEPTH", "MD"]
    depth_name = next((d for d in depth_candidates if d in data_rows[0]), list(data_rows[0].keys())[0])
    normalized = []
    for row in data_rows:
        d = row.get(depth_name)
        if d is None:
            continue
        clean = {clean_mnemonic(k): v for k, v in row.items()}
        clean["DEPTH"] = d
        normalized.append(clean)

    normalized.sort(key=lambda r: r["DEPTH"])
    all_curves = [
        c for c in (data_columns or curves or list(normalized[0].keys()))
        if clean_mnemonic(c) not in {depth_name, "DEPTH", "DEPT", "MD"}
    ]
    all_curves = [clean_mnemonic(c) for c in all_curves if clean_mnemonic(c) in normalized[0]]

    for c in all_curves:
        vals = [r.get(c) for r in normalized]
        valid_count = sum(v is not None for v in vals)
        if valid_count >= 2 and valid_count / max(len(vals), 1) > 0.03:
            vals = interpolate_curve(vals)
            for i, v in enumerate(vals):
                normalized[i][c] = v

    depths = [r["DEPTH"] for r in normalized]
    meta.setdefault("WELL", "Loaded Well")
    meta.setdefault("COMP", "N/A")
    meta.setdefault("FLD", "N/A")
    meta.setdefault("CNTY", "N/A")
    meta.setdefault("STAT", "N/A")
    meta.setdefault("CTRY", "N/A")
    meta.setdefault("API", meta.get("UWI", "N/A"))
    meta["START_DEPTH"] = round(min(depths), 2)
    meta["STOP_DEPTH"] = round(max(depths), 2)
    meta["DEPTH_UNIT"] = units.get(depth_name, units.get("DEPT", "")) or meta.get("STRT_UNIT", "") or ""
    meta["ROWS"] = len(normalized)
    meta["CURVE_COUNT"] = len(all_curves)
    meta["FILE_NAME"] = Path(path).name
    return normalized, all_curves, units, meta


def interpolate_curve(values):
    out = list(values)
    valid = [(i, v) for i, v in enumerate(out) if v is not None]
    if len(valid) < 2:
        return out
    first_i, first_v = valid[0]
    last_i, last_v = valid[-1]
    for i in range(0, first_i):
        out[i] = first_v
    for i in range(last_i + 1, len(out)):
        out[i] = last_v
    last_valid_i, last_valid_v = valid[0]
    for i, v in valid[1:]:
        gap = i - last_valid_i
        if gap > 1:
            for j in range(1, gap):
                t = j / gap
                out[last_valid_i + j] = last_valid_v + (v - last_valid_v) * t
        last_valid_i, last_valid_v = i, v
    return out


def find_curve(columns, candidates):
    upper = {str(c).strip().upper(): str(c).strip().upper() for c in columns}
    for cand in candidates:
        if cand.upper() in upper:
            return upper[cand.upper()]
    for cand in candidates:
        cu = cand.upper()
        for k, v in upper.items():
            if k.startswith(cu) or cu in k:
                return v
    return None


def infer_mapping(curves):
    return {std: find_curve(curves, aliases) for std, aliases in ALIASES.items()}


def normalize_porosity_value(value, curve_name, units):
    if value is None:
        return None
    unit = (units.get(str(curve_name).upper(), "") or "").strip().upper()
    if "%" in unit or value > 1.2:
        return value / 100.0
    return value


def get_curve(rows, curve_name, units=None, porosity=False):
    if not curve_name:
        return [None] * len(rows)
    name = str(curve_name).upper()
    vals = [to_float(r.get(name)) for r in rows]
    if porosity:
        vals = [normalize_porosity_value(v, name, units or {}) for v in vals]
    return vals


def calculate_screening(rows, params, units=None):
    units = units or {}
    depth = [r["DEPTH"] for r in rows]
    gr = get_curve(rows, params.get("gr_curve"), units)
    rhob = get_curve(rows, params.get("rhob_curve"), units)
    nphi = get_curve(rows, params.get("nphi_curve"), units, porosity=True)
    rt = get_curve(rows, params.get("rt_curve"), units)
    gr_clean = safe_float(params.get("gr_clean"), percentile(gr, 5, 30.0))
    gr_shale = safe_float(params.get("gr_shale"), percentile(gr, 95, 120.0))
    denom = max(gr_shale - gr_clean, 1e-6)
    matrix_density = safe_float(params.get("matrix_density"), 2.65)
    fluid_density = safe_float(params.get("fluid_density"), 1.0)
    phie_curve = params.get("phie_curve")
    perm_curve = params.get("perm_curve")
    phie_input = get_curve(rows, phie_curve, units, porosity=True) if phie_curve else [None] * len(rows)
    perm_input = get_curve(rows, perm_curve, units) if perm_curve else [None] * len(rows)
    phie_cut = safe_float(params.get("phie_cutoff"), 0.10)
    vsh_cut = safe_float(params.get("vsh_cutoff"), 0.30)
    perm_cut = safe_float(params.get("perm_cutoff"), 15.0)
    min_thick = safe_float(params.get("min_thickness"), 10.0)

    calculated = []
    for i, d in enumerate(depth):
        g = gr[i]
        rden = rhob[i]
        npv = nphi[i]
        res = rt[i]
        vsh = clamp(((g - gr_clean) / denom), 0, 1) if g is not None else None
        phi_density = clamp((matrix_density - rden) / max(matrix_density - fluid_density, 1e-6), 0, 0.45) if rden is not None else None
        phi_neutron = clamp(npv, 0, 0.45) if npv is not None else None
        if phie_input[i] is not None:
            phie = clamp(phie_input[i], 0, 0.45)
        else:
            phit = mean([phi_density, phi_neutron], None)
            phie = clamp(phit * (1 - (vsh if vsh is not None else 0)), 0, 0.45) if phit is not None else None
        if perm_input[i] is not None:
            perm = max(0, perm_input[i])
        else:
            sw_proxy = None
            if res is not None and res > 0:
                sw_proxy = clamp(1 / math.sqrt(res), 0.15, 1.0)
            perm = clamp(2500 * (phie ** 3) / ((sw_proxy or 0.7) ** 2), 0, 3000) if phie is not None else None
        flag = int(phie is not None and vsh is not None and perm is not None and phie >= phie_cut and vsh <= vsh_cut and perm >= perm_cut)
        calculated.append({"DEPTH": d, "GR": g, "VSH": vsh, "PHIE": phie, "PERM_MD": perm, "RT": res, "SCREEN_FLAG": flag})

    data_top = min(depth) if depth else None
    data_base = max(depth) if depth else None
    req_top = safe_float(params.get("depth_top"), data_top)
    req_base = safe_float(params.get("depth_base"), data_base)
    if req_top is not None and req_base is not None and req_top > req_base:
        req_top, req_base = req_base, req_top
    screening_rows = [r for r in calculated if (req_top is None or r["DEPTH"] >= req_top) and (req_base is None or r["DEPTH"] <= req_base)]
    if not screening_rows:
        screening_rows = calculated
        req_top, req_base = data_top, data_base

    zones = _build_candidate_zones(screening_rows, phie_cut, vsh_cut, perm_cut, min_thick)
    poor_zones = _build_poor_zones(screening_rows, phie_cut, vsh_cut, perm_cut, min_thick)
    all_zones = zones + poor_zones
    summary = {
        "zones_found": len(zones),
        "poor_zones_found": len(poor_zones),
        "net_screened_m": round(sum(z["thickness_m"] for z in zones), 2),
        "best_zone": zones[0]["zone"] if zones else "None",
        "las_depth_start_m": round(data_top, 2) if data_top is not None else None,
        "las_depth_stop_m": round(data_base, 2) if data_base is not None else None,
        "depth_used_top_m": round(req_top, 2) if req_top is not None else None,
        "depth_used_base_m": round(req_base, 2) if req_base is not None else None,
        "visual_depth_top": round(req_top, 2) if req_top is not None else None,
        "visual_depth_base": round(req_base, 2) if req_base is not None else None,
        "rows_used_for_screening": len(screening_rows),
        "phie_cutoff": phie_cut,
        "vsh_cutoff": vsh_cut,
        "perm_cutoff_md": perm_cut,
        "min_thickness_m": min_thick,
        "phie_source": "LAS PHIE/porosity curve" if phie_curve else "Calculated from density/neutron and Vsh correction",
        "perm_source": "LAS permeability curve" if perm_curve else "Screening proxy from PHIE and resistivity trend",
        "technical_note": "Preliminary CCS screening only. This is not storage capacity, injection approval, geomechanics, seal integrity, or reservoir simulation.",
    }
    return calculated, all_zones, summary


def _build_candidate_zones(rows, phie_cut, vsh_cut, perm_cut, min_thick):
    zones = []
    start = None
    for i, row in enumerate(rows):
        is_flag = row["SCREEN_FLAG"] == 1
        if is_flag and start is None:
            start = i
        at_end = i == len(rows) - 1
        if start is not None and ((not is_flag) or at_end):
            end = i if is_flag and at_end else i - 1
            zrows = rows[start:end + 1]
            top = zrows[0]["DEPTH"]
            base = zrows[-1]["DEPTH"]
            thickness = abs(base - top)
            if thickness >= min_thick:
                avg_phie = mean([r["PHIE"] for r in zrows], 0)
                avg_vsh = mean([r["VSH"] for r in zrows], 0)
                avg_perm = mean([r["PERM_MD"] for r in zrows], 0)
                score = (
                    min(avg_phie / max(phie_cut, 0.01), 2.0) * 35
                    + min(vsh_cut / max(avg_vsh, 0.01), 2.0) * 25
                    + min(avg_perm / max(perm_cut, 1), 3.0) * 25
                    + min(thickness / 50, 2.0) * 15
                )
                score = round(min(score, 100), 1)
                status = "Excellent" if score >= 85 else "Good" if score >= 70 else "Review"
                reason = (
                    f"{status}: PHIE {avg_phie:.3f} vs cutoff >= {phie_cut:.2f}, "
                    f"Vsh {avg_vsh:.3f} vs boundary <= {vsh_cut:.2f}, "
                    f"permeability {avg_perm:.1f} mD vs cutoff >= {perm_cut:.1f} mD, "
                    f"and thickness {thickness:.1f} m vs minimum {min_thick:.1f} m. "
                    "Green highlighted intervals indicate possible CO2 storage candidates."
                )
                zones.append(_zone_dict(zones, zrows, top, base, thickness, avg_phie, avg_vsh, avg_perm, score, status, reason, "User-defined / mark in formation tops"))
            start = None
    return zones


def _build_poor_zones(rows, phie_cut, vsh_cut, perm_cut, min_thick):
    poor_zones = []
    start = None
    for i, row in enumerate(rows):
        phie = row.get("PHIE")
        vsh = row.get("VSH")
        perm = row.get("PERM_MD")
        is_poor = phie is not None and vsh is not None and perm is not None and (phie < phie_cut or vsh > vsh_cut or perm < perm_cut)
        if is_poor and start is None:
            start = i
        at_end = i == len(rows) - 1
        if start is not None and ((not is_poor) or at_end):
            end = i if is_poor and at_end else i - 1
            zrows = rows[start:end + 1]
            top = zrows[0]["DEPTH"]
            base = zrows[-1]["DEPTH"]
            thickness = abs(base - top)
            if thickness >= min_thick:
                avg_phie = mean([r["PHIE"] for r in zrows], 0)
                avg_vsh = mean([r["VSH"] for r in zrows], 0)
                avg_perm = mean([r["PERM_MD"] for r in zrows], 0)
                failed = []
                if avg_phie < phie_cut:
                    failed.append(f"average PHIE {avg_phie:.3f} is below cutoff >= {phie_cut:.2f}")
                if avg_vsh > vsh_cut:
                    failed.append(f"average Vsh {avg_vsh:.3f} is above poor boundary <= {vsh_cut:.2f}")
                if avg_perm < perm_cut:
                    failed.append(f"average permeability {avg_perm:.1f} mD is below cutoff >= {perm_cut:.1f}")
                reason = "Poor: " + "; ".join(failed or ["one or more sample-level cutoffs failed"]) + f". Thickness is {thickness:.1f} m."
                zone = _zone_dict(poor_zones, zrows, top, base, thickness, avg_phie, avg_vsh, avg_perm, 0, "Poor", reason, "Poor boundary / non-candidate")
                zone["zone"] = f"P{len(poor_zones) + 1}"
                poor_zones.append(zone)
            start = None
    return poor_zones


def _zone_dict(existing, rows, top, base, thickness, avg_phie, avg_vsh, avg_perm, score, status, reason, formation):
    return {
        "zone": f"Z{len(existing) + 1}",
        "formation": formation,
        "top_m": round(top, 2),
        "base_m": round(base, 2),
        "thickness_m": round(thickness, 2),
        "avg_phie": round(avg_phie, 3),
        "avg_vsh": round(avg_vsh, 3),
        "avg_perm_md": round(avg_perm, 1),
        "avg_gr_api": round(mean([r["GR"] for r in rows], 0), 2),
        "avg_rt_ohmm": round(mean([r["RT"] for r in rows], 0), 2),
        "net_to_gross": round(sum(1 for r in rows if r.get("SCREEN_FLAG") == 1) / max(len(rows), 1), 3),
        "screening_score": score,
        "status": status,
        "reason": reason,
    }


def sample_points(calculated, max_points=1400):
    if len(calculated) <= max_points:
        return calculated
    step = max(1, math.ceil(len(calculated) / max_points))
    sampled = calculated[::step]
    if sampled[-1] is not calculated[-1]:
        sampled.append(calculated[-1])
    return sampled


def values_for_plot(calculated, curve):
    return [row.get(curve) for row in calculated]


def plot_logs(calculated, curves, params=None, title="Preliminary CCS Screening Study Using Well Logs"):
    params = params or {}
    phie_cut = safe_float(params.get("phie_cutoff"), 0.10)
    vsh_cut = safe_float(params.get("vsh_cutoff"), 0.30)
    perm_cut = safe_float(params.get("perm_cutoff"), 15.0)
    all_depths = values_for_plot(calculated, "DEPTH")
    data_top = min(all_depths) if all_depths else None
    data_base = max(all_depths) if all_depths else None
    req_top = safe_float(params.get("depth_top"), data_top)
    req_base = safe_float(params.get("depth_base"), data_base)
    if req_top is not None and req_base is not None and req_top > req_base:
        req_top, req_base = req_base, req_top
    filtered = [r for r in calculated if (req_top is None or r["DEPTH"] >= req_top) and (req_base is None or r["DEPTH"] <= req_base)]
    if not filtered:
        filtered = calculated
        req_top, req_base = data_top, data_base
    calc = sample_points(filtered)
    depth = values_for_plot(calc, "DEPTH")
    chosen = [c for c in curves if calc and c in calc[0]] if calc else []
    if not chosen:
        chosen = ["GR", "VSH", "PHIE", "PERM_MD"]
    n = max(len(chosen), 1)
    gap = 0.006
    width = (1.0 - gap * (n - 1)) / n
    domains = [[i * (width + gap), i * (width + gap) + width] for i in range(n)]
    traces = []
    for i, curve in enumerate(chosen, start=1):
        axis_name = "x" if i == 1 else f"x{i}"
        traces.append({
            "type": "scatter",
            "x": values_for_plot(calc, curve),
            "y": depth,
            "mode": "lines",
            "name": curve,
            "xaxis": axis_name,
            "yaxis": "y",
            "line": {"width": 1.8},
            "hovertemplate": f"{curve}: %{{x:.4f}}<br>Depth: %{{y:.2f}} m<extra></extra>",
        })

    def intervals_by_condition(condition):
        intervals = []
        start_depth = None
        prev_depth = None
        for row in calc:
            is_match = condition(row)
            if is_match and start_depth is None:
                start_depth = row.get("DEPTH")
            if start_depth is not None and not is_match:
                intervals.append((start_depth, prev_depth))
                start_depth = None
            prev_depth = row.get("DEPTH")
        if start_depth is not None:
            intervals.append((start_depth, prev_depth))
        return [(a, b) for a, b in intervals if a is not None and b is not None and abs(b - a) > 0]

    def is_poor(row):
        phie = row.get("PHIE")
        vsh = row.get("VSH")
        perm = row.get("PERM_MD")
        return phie is not None and vsh is not None and perm is not None and (phie < phie_cut or vsh > vsh_cut or perm < perm_cut)

    co2_intervals = intervals_by_condition(lambda r: r.get("SCREEN_FLAG") == 1)
    poor_intervals = intervals_by_condition(is_poor)
    shapes = []
    annotations = []
    for a, _b in co2_intervals[:30]:
        shapes.append({"type": "line", "xref": "paper", "yref": "y", "x0": 0, "x1": 1, "y0": a, "y1": a, "line": {"color": "#10b981", "width": 2.2, "dash": "solid"}, "layer": "above"})
    for a, _b in poor_intervals[:40]:
        shapes.append({"type": "line", "xref": "paper", "yref": "y", "x0": 0, "x1": 1, "y0": a, "y1": a, "line": {"color": "#ef4444", "width": 1.4, "dash": "dot"}, "layer": "above"})
    for idx, (a, _b) in enumerate(co2_intervals[:8], start=1):
        annotations.append({"xref": "paper", "yref": "y", "x": 0.01, "y": a, "text": f"CO2 Top Z{idx}", "showarrow": False, "font": {"size": 10, "color": "#bbf7d0"}, "bgcolor": "rgba(16,185,129,0.24)", "bordercolor": "rgba(16,185,129,0.75)", "borderpad": 3})
    for _idx, (a, _b) in enumerate(poor_intervals[:6], start=1):
        annotations.append({"xref": "paper", "yref": "y", "x": 0.99, "y": a, "text": "Poor boundary", "showarrow": False, "xanchor": "right", "font": {"size": 10, "color": "#fecaca"}, "bgcolor": "rgba(239,68,68,0.20)", "bordercolor": "rgba(239,68,68,0.70)", "borderpad": 3})

    layout = {
        "title": {"text": title, "font": {"size": 14, "color": "#e2e8f0"}},
        "paper_bgcolor": "#0b1220",
        "plot_bgcolor": "#0f172a",
        "font": {"color": "#cbd5e1", "size": 11},
        "height": 640,
        "autosize": True,
        "margin": {"l": 48, "r": 8, "t": 45, "b": 45, "pad": 0},
        "uirevision": "ccus-log-viewer",
        "yaxis": {"title": "Depth", "autorange": False, "range": [req_base, req_top], "showgrid": True, "gridcolor": "#1e293b"},
        "legend": {"orientation": "h", "y": -0.08},
        "hovermode": "y unified",
        "shapes": shapes,
        "annotations": annotations,
    }
    for i in range(1, n + 1):
        key = "xaxis" if i == 1 else f"xaxis{i}"
        layout[key] = {"domain": domains[i - 1], "anchor": "y", "title": chosen[i - 1], "showgrid": True, "gridcolor": "#1e293b"}
    return {"data": traces, "layout": layout}


def make_sample_las(sample_dir):
    sample_dir = Path(sample_dir)
    sample_dir.mkdir(parents=True, exist_ok=True)
    sample = sample_dir / "gullfaks_ccs_screening_sample.las"
    depths = [2050 + i * 0.5 for i in range(int((2450 - 2050) / 0.5) + 1)]
    random.seed(42)
    lines = [
        "~Version Information", " VERS. 2.0", " WRAP. NO",
        "~Well Information", " STRT.M 2050", " STOP.M 2450", " STEP.M 0.5", " NULL. -999.25",
        " WELL. C7_CCS_SCREENING_DEMO", " FLD . Gullfaks", " COMP. Drake AI Demo", " CTRY. Norway",
        "~Curve Information", " DEPT.M : Depth", " GR.API : Gamma Ray", " RHOB.G/C3 : Bulk Density",
        " NPHI.V/V : Neutron Porosity", " RT.OHMM : Deep Resistivity", " DT.US/F : Sonic", "~ASCII"
    ]
    for d in depths:
        clean = (2110 < d < 2188) or (2245 < d < 2310)
        gr = (42 + random.gauss(0, 4)) if clean else (82 + random.gauss(0, 10))
        rhob = (2.32 + random.gauss(0, .03)) if clean else (2.52 + random.gauss(0, .04))
        nphi = (.22 + random.gauss(0, .025)) if clean else (.11 + random.gauss(0, .025))
        rt = (38 + random.gauss(0, 8)) if clean else (11 + random.gauss(0, 3))
        dt = (86 + random.gauss(0, 5)) if clean else (67 + random.gauss(0, 4))
        lines.append(f"{d:.4f} {gr:.4f} {rhob:.4f} {nphi:.4f} {rt:.4f} {dt:.4f}")
    sample.write_text("\n".join(lines), encoding="utf-8")
    return sample


def _xlsx_col_name(index):
    name = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        name = chr(65 + rem) + name
    return name


def _xml_cell(value, row_idx, col_idx):
    ref = f"{_xlsx_col_name(col_idx)}{row_idx}"
    if value is None:
        value = ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"><v>{value}</v></c>'
    safe = html.escape(str(value), quote=True)
    return f'<c r="{ref}" t="inlineStr"><is><t>{safe}</t></is></c>'


def write_zones_xlsx(path, zones, summary, meta, calculated=None, params=None):
    calculated = calculated or []
    params = params or {}
    zone_headers = ["Zone", "Result Type", "Formation/Boundary", "Top (m)", "Base (m)", "Thickness (m)", "Average Porosity PHIE", "Average Vsh", "Average Permeability (mD)", "Average GR (API)", "Average RT (ohm-m)", "Net-to-Gross", "Screening Score", "Status", "Reason"]
    zone_rows = [zone_headers]
    if zones:
        for z in zones:
            status = z.get("status", "")
            result_type = "CO2 Storage Candidate" if status in {"Excellent", "Good", "Review"} else "Poor / Non-Candidate Boundary"
            zone_rows.append([z.get("zone"), result_type, z.get("formation"), z.get("top_m"), z.get("base_m"), z.get("thickness_m"), z.get("avg_phie"), z.get("avg_vsh"), z.get("avg_perm_md"), z.get("avg_gr_api"), z.get("avg_rt_ohmm"), z.get("net_to_gross"), z.get("screening_score"), status, z.get("reason")])
    else:
        zone_rows.append(["No zones", "No matching intervals", "No interval met current selected cutoffs", "", "", "", "", "", "", "", "", "", "", "Poor", "Check PHIE, Vsh, permeability, minimum thickness, and selected depth range."])

    summary_rows = [
        ["Preliminary CCS Screening Study Using Well Logs", ""],
        ["Well Name", meta.get("WELL", "Loaded Well")],
        ["Uploaded LAS File", meta.get("FILE_NAME", "N/A")],
        ["LAS Depth Start (m)", summary.get("las_depth_start_m", meta.get("START_DEPTH"))],
        ["LAS Depth Stop (m)", summary.get("las_depth_stop_m", meta.get("STOP_DEPTH"))],
        ["Depth Used - Top (m)", summary.get("depth_used_top_m")],
        ["Depth Used - Base (m)", summary.get("depth_used_base_m")],
        ["Rows Used for Screening", summary.get("rows_used_for_screening")],
        ["Candidate Zones", summary.get("zones_found", 0)],
        ["Poor Boundary Zones", summary.get("poor_zones_found", 0)],
        ["Net Screened Thickness (m)", summary.get("net_screened_m", 0)],
        ["Best Zone", summary.get("best_zone", "None")],
        ["PHIE Cutoff", summary.get("phie_cutoff")],
        ["Vsh Cutoff", summary.get("vsh_cutoff")],
        ["Permeability Cutoff (mD)", summary.get("perm_cutoff_md")],
        ["Minimum Thickness (m)", summary.get("min_thickness_m")],
        ["PHIE Source", summary.get("phie_source")],
        ["Permeability Source", summary.get("perm_source")],
        ["Export Time", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
        ["Note", "Preliminary CCS screening only; not storage capacity, injection approval, geomechanics, seal integrity, or reservoir simulation."],
    ]

    data_rows = [["Depth (m)", "GR (API)", "Vsh", "PHIE", "Permeability (mD)", "RT (ohm-m)", "Screen Flag"]]
    for r in calculated:
        data_rows.append([
            round(r.get("DEPTH"), 3) if isinstance(r.get("DEPTH"), (int, float)) else r.get("DEPTH"),
            round(r.get("GR"), 3) if isinstance(r.get("GR"), (int, float)) else r.get("GR"),
            round(r.get("VSH"), 4) if isinstance(r.get("VSH"), (int, float)) else r.get("VSH"),
            round(r.get("PHIE"), 4) if isinstance(r.get("PHIE"), (int, float)) else r.get("PHIE"),
            round(r.get("PERM_MD"), 3) if isinstance(r.get("PERM_MD"), (int, float)) else r.get("PERM_MD"),
            round(r.get("RT"), 3) if isinstance(r.get("RT"), (int, float)) else r.get("RT"),
            r.get("SCREEN_FLAG"),
        ])

    def sheet_xml(rows, widths=None):
        cols = ""
        if widths:
            cols = "<cols>" + "".join(f'<col min="{i+1}" max="{i+1}" width="{w}" customWidth="1"/>' for i, w in enumerate(widths)) + "</cols>"
        xml_rows = []
        for r_idx, row in enumerate(rows, 1):
            cells = ''.join(_xml_cell(v, r_idx, c_idx) for c_idx, v in enumerate(row))
            xml_rows.append(f'<row r="{r_idx}">{cells}</row>')
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews>' + cols + '<sheetData>' + ''.join(xml_rows) + '</sheetData></worksheet>'

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>"""
    wb = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Zone Results" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/><sheet name="Calculated Data" sheetId="3" r:id="rId3"/></sheets></workbook>"""
    wb_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("xl/workbook.xml", wb)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml(zone_rows, [12, 26, 30, 12, 12, 14, 18, 14, 22, 16, 18, 14, 16, 14, 95]))
        zf.writestr("xl/worksheets/sheet2.xml", sheet_xml(summary_rows, [30, 80]))
        zf.writestr("xl/worksheets/sheet3.xml", sheet_xml(data_rows, [12, 12, 12, 12, 18, 14, 12]))


def build_calculation_response(session, payload):
    rows = session["rows"]
    units = session.get("units", {})
    calc, zones, summary = calculate_screening(rows, payload, units)
    selected = payload.get("plot_curves") or ["GR", "VSH", "PHIE", "PERM_MD"]
    preview = [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()} for r in calc[:10]]
    return {
        "summary": summary,
        "zones": zones,
        "preview": preview,
        "log_plot": plot_logs(calc, selected, payload),
        "calculated": calc,
        "params": payload,
    }


def session_from_las(path, display_name=None):
    rows, curves, units, meta = parse_las_text(path)
    if display_name:
        meta["FILE_NAME"] = display_name
    return {
        "id": uuid.uuid4().hex,
        "path": str(path),
        "rows": rows,
        "curves": curves,
        "units": units,
        "meta": meta,
        "mapping": infer_mapping(curves),
        "last": None,
    }

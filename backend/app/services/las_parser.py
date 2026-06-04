"""LAS file parser — uses lasio library"""
import lasio
import numpy as np
from typing import Dict, Any, List


def parse_las_file(filepath: str) -> Dict[str, Any]:
    """
    Parse a LAS file and return structured data.
    Returns: {start, stop, step, header, curves: [{mnemonic, unit, data, ...}]}
    """
    las = lasio.read(filepath)

    header = {}
    try:
        header = {
            "well_name": las.well.WELL.value if hasattr(las.well, "WELL") else "",
            "field": las.well.FLD.value if hasattr(las.well, "FLD") else "",
            "company": las.well.COMP.value if hasattr(las.well, "COMP") else "",
            "county": las.well.CNTY.value if hasattr(las.well, "CNTY") else "",
            "state": las.well.STAT.value if hasattr(las.well, "STAT") else "",
            "kb": las.well.KB.value if hasattr(las.well, "KB") else None,
        }
    except Exception:
        pass

    curves = []
    depths = las.index.tolist()
    null_val = las.well.NULL.value if hasattr(las.well, "NULL") else -9999.25

    for curve in las.curves:
        if curve.mnemonic.upper() in ("DEPT", "DEPTH", "MD", "TVD"):
            continue

        values = curve.data.tolist()
        clean_vals = [
            v if (v is not None and not np.isnan(v) and v != null_val) else None
            for v in values
        ]
        valid = [v for v in clean_vals if v is not None]

        curves.append({
            "mnemonic": curve.mnemonic.upper(),
            "unit": curve.unit,
            "description": curve.descr,
            "data": {
                "depths": depths,
                "values": clean_vals,
            },
            "min_value": float(np.min(valid)) if valid else None,
            "max_value": float(np.max(valid)) if valid else None,
            "mean_value": float(np.mean(valid)) if valid else None,
            "null_count": len([v for v in clean_vals if v is None]),
        })

    return {
        "start": float(las.well.STRT.value) if hasattr(las.well, "STRT") else (depths[0] if depths else None),
        "stop": float(las.well.STOP.value) if hasattr(las.well, "STOP") else (depths[-1] if depths else None),
        "step": float(las.well.STEP.value) if hasattr(las.well, "STEP") else None,
        "header": header,
        "curves": curves,
    }

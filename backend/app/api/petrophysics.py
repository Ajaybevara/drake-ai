from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Well, Curve
from app.ml.drake_uncertainty import build_prediction_bundle, compute_uncertainty_analysis

router = APIRouter()


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

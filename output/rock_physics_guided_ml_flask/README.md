# Rock Physics Guided ML - Standalone Flask Module

Standalone Flask version of the Rock Physics Guided ML module.

## Features

- Upload LAS files
- Load built-in demo data
- Predict PHIE, SW, VSH, KLOG, or FACIES
- Derive rock-physics features:
  - VSH from GR
  - density porosity
  - density-neutron separation
  - blended porosity
  - velocity proxy from DT
  - acoustic impedance
  - VP/VS from DT and DTS
  - log resistivity
  - depth trend
  - zone ID
- Train scikit-learn ML models
- Show prediction chart, feature importance, zone summary, and results table

## Run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5055
```

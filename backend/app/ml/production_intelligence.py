"""Production Intelligence workflow ported from Production_Intelligence_Flask."""

from __future__ import annotations

import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score
    from sklearn.model_selection import train_test_split
except Exception:  # pragma: no cover
    RandomForestClassifier = None
    accuracy_score = None
    train_test_split = None


REQUIRED_COLUMNS = [
    "Date", "Well", "Lift Type", "Oil Production (bbl/day)", "Gas Production (mcf/day)",
    "Water Production (bbl/day)", "Tubing Pressure (psi)", "Casing Pressure (psi)",
    "Pump Intake Pressure (psi)", "Pump Discharge Pressure (psi)", "ESP Motor Current (amps)",
    "ESP Motor Voltage (volts)", "Pump Frequency (Hz)", "Vibration (in/s)",
    "Motor Temperature (F)", "Runtime Hours", "Downtime Hours", "Choke Size (64ths)",
    "Maintenance Cost ($)", "Failure Event",
]


def make_sample_data(seed=42):
    rng = np.random.default_rng(seed)
    wells = [f"W-{i:02d}" for i in range(1, 9)]
    dates = pd.date_range("2025-01-01", periods=180, freq="D")
    rows = []
    for well in wells:
        qi = rng.uniform(420, 950)
        decline = rng.uniform(0.0015, 0.0055)
        water_base = rng.uniform(60, 240)
        gas_factor = rng.uniform(1.8, 4.5)
        lift = rng.choice(["ESP", "SRP", "Gas Lift", "PCP"], p=[0.45, 0.25, 0.2, 0.1])
        for t, date in enumerate(dates):
            oil = max(qi * np.exp(-decline * t) + rng.normal(0, 20), 25)
            water = max(water_base + t * rng.uniform(0.2, 1.2) + rng.normal(0, 18), 5)
            gas = max(oil * gas_factor + rng.normal(0, 120), 50)
            tubing = max(900 + oil * 1.2 + rng.normal(0, 80), 350)
            casing = max(650 + gas * 0.06 + rng.normal(0, 70), 250)
            intake = max(550 + oil * 0.35 - water * 0.15 + rng.normal(0, 45), 80)
            discharge = max(intake + 650 + rng.normal(0, 80), intake + 200)
            freq = np.clip(48 + rng.normal(0, 3) - t * 0.004, 35, 62)
            current = np.clip(55 + oil * 0.025 + water * 0.018 + rng.normal(0, 6), 25, 120)
            voltage = np.clip(460 + rng.normal(0, 18), 390, 525)
            vib = max(0.02 + water / oil * 0.04 + rng.normal(0, 0.015), 0.005)
            temp = np.clip(150 + current * 0.7 + rng.normal(0, 10), 120, 260)
            runtime = 24
            downtime = 0
            failure_prob = 0.02 + max(0, water / (oil + 1) - 0.55) * 0.08 + max(0, vib - 0.07) * 2 + max(0, temp - 215) * 0.003
            failure = int(rng.random() < min(failure_prob, 0.45))
            if failure:
                downtime = int(rng.integers(6, 24))
                runtime = 24 - downtime
                oil *= rng.uniform(0.25, 0.7)
            elif rng.random() < 0.08:
                downtime = int(rng.integers(1, 6))
                runtime = 24 - downtime
                oil *= 1 - downtime / 36
            choke = int(np.clip(rng.normal(28, 5), 16, 44))
            maint = failure * rng.uniform(3500, 16000) + downtime * rng.uniform(80, 220)
            rows.append([date.date().isoformat(), well, lift, round(oil, 2), round(gas, 2), round(water, 2), round(tubing, 2), round(casing, 2), round(intake, 2), round(discharge, 2), round(current, 2), round(voltage, 2), round(freq, 2), round(vib, 3), round(temp, 2), runtime, downtime, choke, round(maint, 2), failure])
    return pd.DataFrame(rows, columns=REQUIRED_COLUMNS)


def clean_df(df):
    df = df.copy()
    df = df.rename(columns={col: col.strip() for col in df.columns})
    if "Well" not in df.columns:
        df["Well"] = "W-01"
    if "Lift Type" not in df.columns:
        df["Lift Type"] = "ESP"
    if "Date" not in df.columns:
        df["Date"] = pd.date_range("2025-01-01", periods=len(df), freq="D")
    defaults = {
        "Pump Intake Pressure (psi)": 650, "Pump Discharge Pressure (psi)": 1500,
        "Pump Frequency (Hz)": 50, "Vibration (in/s)": 0.04, "Motor Temperature (F)": 185,
        "Runtime Hours": 24, "Downtime Hours": 0, "Choke Size (64ths)": 28,
        "Maintenance Cost ($)": 0, "Failure Event": 0, "Tubing Pressure (psi)": 1500,
        "Casing Pressure (psi)": 900, "Oil Production (bbl/day)": 300,
        "Gas Production (mcf/day)": 900, "Water Production (bbl/day)": 150,
        "ESP Motor Current (amps)": 65, "ESP Motor Voltage (volts)": 460,
    }
    for col, value in defaults.items():
        if col not in df.columns:
            df[col] = value
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"]).sort_values(["Well", "Date"])
    for col in df.columns:
        if col not in ["Date", "Well", "Lift Type"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.ffill().bfill().fillna(0)
    df["Liquid Rate"] = df["Oil Production (bbl/day)"] + df["Water Production (bbl/day)"]
    df["Water Cut (%)"] = np.where(df["Liquid Rate"] > 0, df["Water Production (bbl/day)"] / df["Liquid Rate"] * 100, 0)
    df["GOR (scf/bbl)"] = np.where(df["Oil Production (bbl/day)"] > 0, df["Gas Production (mcf/day)"] * 1000 / df["Oil Production (bbl/day)"], 0)
    df["Drawdown Proxy"] = df["Casing Pressure (psi)"] - df["Pump Intake Pressure (psi)"]
    return df


def latest_summary(df):
    last = df.sort_values("Date").groupby("Well").tail(1).copy()
    hist = df.groupby("Well").agg(
        avg_oil=("Oil Production (bbl/day)", "mean"),
        avg_water_cut=("Water Cut (%)", "mean"),
        total_downtime=("Downtime Hours", "sum"),
        fail_count=("Failure Event", "sum"),
        avg_runtime=("Runtime Hours", "mean"),
        avg_vib=("Vibration (in/s)", "mean"),
        avg_temp=("Motor Temperature (F)", "mean"),
    ).reset_index()
    return last.merge(hist, on="Well", how="left")


def artificial_lift_failure(df):
    features = ["Oil Production (bbl/day)", "Water Production (bbl/day)", "Water Cut (%)", "GOR (scf/bbl)", "Tubing Pressure (psi)", "Casing Pressure (psi)", "Pump Intake Pressure (psi)", "Pump Discharge Pressure (psi)", "ESP Motor Current (amps)", "ESP Motor Voltage (volts)", "Pump Frequency (Hz)", "Vibration (in/s)", "Motor Temperature (F)", "Runtime Hours"]
    X = df[features].replace([np.inf, -np.inf], 0).fillna(0)
    y = df["Failure Event"].astype(int)
    latest = latest_summary(df)
    model_note = "Rule-based failure risk fallback"
    acc = None
    if RandomForestClassifier is not None and y.nunique() > 1 and len(df) > 50:
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=7, stratify=y)
        model = RandomForestClassifier(n_estimators=120, random_state=7, class_weight="balanced")
        model.fit(Xtr, ytr)
        acc = accuracy_score(yte, model.predict(Xte))
        merged = latest.merge(df.groupby("Well")[features].mean().reset_index(), on="Well", suffixes=("", "_mean"))
        risks = model.predict_proba(merged[features].fillna(0))[:, 1]
        model_note = "Random Forest Classifier"
    else:
        risks = np.clip((latest["avg_water_cut"] / 100) * 0.35 + latest["avg_vib"] * 5 + np.maximum(0, latest["avg_temp"] - 190) / 120 + latest["fail_count"] * 0.08, 0, 1)
    latest["Failure Risk (%)"] = np.round(risks * 100, 1)
    latest["Risk Level"] = pd.cut(latest["Failure Risk (%)"], bins=[-1, 35, 65, 101], labels=["Low", "Medium", "High"])
    latest["Likely Cause"] = np.select([latest["avg_vib"] > 0.08, latest["avg_temp"] > 215, latest["avg_water_cut"] > 65, latest["fail_count"] > 3], ["High vibration / pump wear", "Motor heating / electrical load", "High water loading", "Repeated historical failure"], default="Stable operating envelope")
    return latest[["Well", "Lift Type", "Failure Risk (%)", "Risk Level", "Likely Cause", "fail_count", "total_downtime"]].sort_values("Failure Risk (%)", ascending=False), model_note, acc


def production_optimizer(df):
    last = latest_summary(df)
    decline = df.sort_values("Date").groupby("Well").apply(lambda g: (g["Oil Production (bbl/day)"].tail(14).mean() - g["Oil Production (bbl/day)"].head(14).mean()) / max(g["Oil Production (bbl/day)"].head(14).mean(), 1) * 100).rename("Oil Trend (%)").reset_index()
    out = last.merge(decline, on="Well")
    recs, gains, priorities = [], [], []
    for _, row in out.iterrows():
        if row["Water Cut (%)"] > 70:
            rec, gain, pr = "Reduce drawdown; review water control and pump speed", 3, "High"
        elif row["GOR (scf/bbl)"] > 9000:
            rec, gain, pr = "Check gas interference; tune choke/lift frequency", 5, "Medium"
        elif row["Oil Trend (%)"] < -25:
            rec, gain, pr = "Investigate decline; perform nodal/lift review", 8, "High"
        elif row["Runtime Hours"] < 20:
            rec, gain, pr = "Improve uptime; inspect recurring downtime cause", 10, "High"
        else:
            rec, gain, pr = "Maintain settings; continue surveillance", 1, "Low"
        recs.append(rec); gains.append(gain); priorities.append(pr)
    out["Recommendation"] = recs
    out["Estimated Gain (%)"] = gains
    out["Priority"] = priorities
    return out[["Well", "Oil Production (bbl/day)", "Water Cut (%)", "GOR (scf/bbl)", "Oil Trend (%)", "Estimated Gain (%)", "Priority", "Recommendation"]].sort_values(["Priority", "Estimated Gain (%)"], ascending=[True, False])


def decline_curve(df):
    rows = []
    for well, group in df.sort_values("Date").groupby("Well"):
        group = group.reset_index(drop=True)
        q = group["Oil Production (bbl/day)"].clip(lower=1).values
        t = np.arange(len(q))
        slope, intercept = np.polyfit(t, np.log(q), 1)
        decline = max(-slope, 0.0001)
        q_last = float(q[-1])
        q_econ = 20.0
        remaining_days = max(0, int(np.log(max(q_last, q_econ) / q_econ) / decline)) if decline > 0 else 3650
        eur_remaining = max(0, (q_last - q_econ) / decline) if decline > 0 else q_last * 3650
        rows.append([well, round(float(np.exp(intercept)), 1), round(decline * 365 * 100, 2), round(q_last, 1), remaining_days, round(eur_remaining, 0)])
    return pd.DataFrame(rows, columns=["Well", "Initial Rate qi", "Annual Decline (%)", "Latest Oil Rate", "Days to Economic Limit", "Remaining Oil Estimate (bbl)"]).sort_values("Remaining Oil Estimate (bbl)", ascending=False)


def well_performance(df):
    last = latest_summary(df)
    max_oil = max(last["Oil Production (bbl/day)"].max(), 1)
    score = 100 * (0.35 * last["Oil Production (bbl/day)"] / max_oil + 0.2 * last["Runtime Hours"] / 24 + 0.2 * (1 - last["Water Cut (%)"] / 100) + 0.15 * (1 - np.clip(last["Failure Event"], 0, 1)) + 0.1 * (1 - np.clip(last["Vibration (in/s)"] / 0.15, 0, 1)))
    last["Health Score"] = np.round(np.clip(score, 0, 100), 1)
    last["Status"] = pd.cut(last["Health Score"], bins=[-1, 45, 70, 101], labels=["Critical", "Watch", "Healthy"])
    return last[["Well", "Health Score", "Status", "Oil Production (bbl/day)", "Water Cut (%)", "Runtime Hours", "Failure Event"]].sort_values("Health Score")


def downtime_loss(df, oil_price=75):
    hist = df.groupby("Well").agg(avg_oil=("Oil Production (bbl/day)", "mean"), downtime=("Downtime Hours", "sum"), failures=("Failure Event", "sum"), maintenance=("Maintenance Cost ($)", "sum")).reset_index()
    hist["Lost Oil (bbl)"] = np.round(hist["avg_oil"] / 24 * hist["downtime"], 1)
    hist["Lost Revenue ($)"] = np.round(hist["Lost Oil (bbl)"] * oil_price, 2)
    hist["Total Loss + Maintenance ($)"] = np.round(hist["Lost Revenue ($)"] + hist["maintenance"], 2)
    return hist[["Well", "downtime", "failures", "Lost Oil (bbl)", "Lost Revenue ($)", "maintenance", "Total Loss + Maintenance ($)"]].sort_values("Total Loss + Maintenance ($)", ascending=False)


def workover_ranking(df):
    perf = well_performance(df)
    down = downtime_loss(df)
    dca = decline_curve(df)
    lift, _, _ = artificial_lift_failure(df)
    merged = perf.merge(down, on="Well").merge(dca, on="Well").merge(lift[["Well", "Failure Risk (%)"]], on="Well")
    merged["Workover Score"] = np.round((100 - merged["Health Score"]) * 0.35 + merged["Failure Risk (%)"] * 0.25 + np.clip(merged["downtime"] / 40, 0, 1) * 20 + np.clip(merged["Remaining Oil Estimate (bbl)"] / max(merged["Remaining Oil Estimate (bbl)"].max(), 1), 0, 1) * 20, 1)
    merged["Candidate Priority"] = pd.cut(merged["Workover Score"], bins=[-1, 45, 70, 101], labels=["Low", "Medium", "High"])
    merged["Suggested Workover"] = np.select([merged["Failure Risk (%)"] > 65, merged["Water Cut (%)"] > 70, merged["downtime"] > 60, merged["Annual Decline (%)"] > 80], ["Artificial lift inspection/redesign", "Water shutoff or conformance review", "Reliability workover / downtime fix", "Production logging and recompletion study"], default="Monitor / routine optimization")
    return merged[["Well", "Workover Score", "Candidate Priority", "Suggested Workover", "Health Score", "Failure Risk (%)", "downtime", "Remaining Oil Estimate (bbl)"]].sort_values("Workover Score", ascending=False)


def _records(df, limit=12):
    return df.head(limit).replace([np.inf, -np.inf], np.nan).where(pd.notna(df), None).to_dict("records")


def analyze_production(df):
    df = clean_df(df)
    lift, model_note, acc = artificial_lift_failure(df)
    optimizer = production_optimizer(df)
    decline = decline_curve(df)
    performance = well_performance(df)
    downtime = downtime_loss(df)
    workover = workover_ranking(df)
    daily = df.groupby("Date")[["Oil Production (bbl/day)", "Water Production (bbl/day)", "Gas Production (mcf/day)"]].sum().reset_index()
    daily["Date"] = daily["Date"].dt.strftime("%Y-%m-%d")
    summary = {
        "wells": int(df["Well"].nunique()),
        "records": int(len(df)),
        "total_oil": round(float(df["Oil Production (bbl/day)"].sum()), 1),
        "avg_water_cut": round(float(df["Water Cut (%)"].mean()), 2),
        "downtime_hours": round(float(df["Downtime Hours"].sum()), 1),
        "failure_events": int(df["Failure Event"].sum()),
        "model": model_note,
        "accuracy": round(float(acc), 3) if acc is not None else None,
    }
    return {
        "summary": summary,
        "trend": daily.tail(120).to_dict("records"),
        "modules": {
            "lift_failure": {"title": "AI Artificial Lift Failure", "rows": _records(lift), "note": model_note},
            "optimizer": {"title": "Production Optimizer", "rows": _records(optimizer), "note": "Operating opportunities ranked by water cut, GOR, trend, runtime, and pressure behavior."},
            "decline": {"title": "Decline Curve Analysis", "rows": _records(decline), "note": "Exponential decline fit on historical oil rate."},
            "performance": {"title": "Well Performance Monitoring", "rows": _records(performance), "note": "Health score combines oil rate, runtime, water cut, failures, and vibration."},
            "downtime": {"title": "Downtime & Loss Production Analysis", "rows": _records(downtime), "note": "Lost oil and revenue from downtime; oil price assumed at $75/bbl."},
            "workover": {"title": "Workover Candidate Ranking", "rows": _records(workover), "note": "Ranks interventions from health, lift risk, downtime, and remaining potential."},
        },
    }

"""Seed initial data: admin user + demo project + wells"""
import numpy as np
from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models import User, Project, Well, Curve, FormationTop, UserRole
import random


def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ── Admin user ──────────────────────────────────────────────────────
        if not db.query(User).filter(User.email == "admin@drakeai.com").first():
            admin = User(
                email="admin@drakeai.com",
                full_name="Malleswar Y.",
                hashed_password=hash_password("Drake@2024"),
                role=UserRole.admin,
                avatar_initials="MY",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"[OK] Admin user created: admin@drakeai.com / Drake@2024")

            # ── Demo Project ────────────────────────────────────────────────
            project = Project(
                name="Permian Basin Study",
                description="Wolfcamp and Bone Spring formation evaluation",
                field_name="Red Canyon",
                basin="Permian",
                country="USA",
                operator="Drake Energy",
                owner_id=admin.id,
            )
            db.add(project)

            project2 = Project(
                name="Eagle Ford Study",
                description="Eagle Ford shale petrophysics",
                field_name="South Texas",
                basin="Gulf Coast",
                country="USA",
                operator="Drake Energy",
                owner_id=admin.id,
            )
            db.add(project2)
            db.commit()

            # ── Demo Wells ──────────────────────────────────────────────────
            wells_data = [
                {"name": "SMITH_12H", "api": "42-123-45678", "field": "Red Canyon", "county": "Lea, New Mexico",
                 "kb": 3455, "td": 12842, "top": 7000, "base": 12842, "status": "Completed"},
                {"name": "JONES_07H",  "api": "42-123-45679", "field": "Red Canyon", "county": "Lea, New Mexico",
                 "kb": 3420, "td": 11200, "top": 6800, "base": 11200, "status": "Active"},
                {"name": "BROWN_15H", "api": "42-123-45680", "field": "Blue Canyon", "county": "Eddy, New Mexico",
                 "kb": 3500, "td": 13100, "top": 7200, "base": 13100, "status": "Completed"},
                {"name": "WILSON_03H","api": "42-123-45681", "field": "Red Canyon", "county": "Lea, New Mexico",
                 "kb": 3380, "td": 10800, "top": 6900, "base": 10800, "status": "QC Required"},
                {"name": "DAVIS_11H", "api": "42-123-45682", "field": "Blue Canyon", "county": "Eddy, New Mexico",
                 "kb": 3460, "td": 12400, "top": 7100, "base": 12400, "status": "Active"},
            ]

            for wd in wells_data:
                w = Well(
                    project_id=project.id,
                    name=wd["name"], api_number=wd["api"],
                    operator="Drake Energy", field=wd["field"],
                    county=wd["county"], state="New Mexico", country="USA",
                    kb_elevation=wd["kb"], total_depth=wd["td"],
                    top_depth=wd["top"], base_depth=wd["base"],
                    depth_uom="ft", status=wd["status"],
                )
                db.add(w)

            db.commit()
            print(f"[OK] Demo wells created")

            # ── Seed curves for SMITH_12H ────────────────────────────────
            smith = db.query(Well).filter(Well.name == "SMITH_12H").first()
            if smith:
                _seed_well_curves(db, smith)
                _seed_formation_tops(db, smith)
                print(f"[OK] Curves & tops seeded for SMITH_12H")

        else:
            print("[INFO] Seed data already exists, skipping.")

    except Exception as e:
        print(f"[ERROR] Seed error: {e}")
        db.rollback()
    finally:
        db.close()


def _seed_well_curves(db, well: Well):
    np.random.seed(42)
    depths = list(np.arange(7000, 12842, 0.5))
    n = len(depths)

    curves_def = [
        {"mnemonic": "GR",   "unit": "API",    "desc": "Gamma Ray",
         "gen": lambda: (60 + 40 * np.sin(np.array(depths)/120) + np.random.normal(0, 10, n)).clip(5, 150).tolist()},
        {"mnemonic": "RHOB", "unit": "g/cc",   "desc": "Bulk Density",
         "gen": lambda: (2.45 + 0.2 * np.sin(np.array(depths)/80) + np.random.normal(0, 0.04, n)).clip(1.95, 2.95).tolist()},
        {"mnemonic": "NPHI", "unit": "v/v",    "desc": "Neutron Porosity",
         "gen": lambda: (0.22 - 0.08 * np.sin(np.array(depths)/80) + np.random.normal(0, 0.02, n)).clip(-0.05, 0.45).tolist()},
        {"mnemonic": "RT",   "unit": "ohm.m",  "desc": "True Resistivity",
         "gen": lambda: (10 ** (1.5 + 0.8 * np.sin(np.array(depths)/90) + np.random.normal(0, 0.3, n))).clip(0.2, 2000).tolist()},
        {"mnemonic": "DT",   "unit": "us/ft",  "desc": "Sonic Delta-T",
         "gen": lambda: (80 + 30 * np.sin(np.array(depths)/100) + np.random.normal(0, 5, n)).clip(40, 140).tolist()},
        {"mnemonic": "CALI", "unit": "in",     "desc": "Caliper",
         "gen": lambda: (8.5 + np.random.normal(0, 0.3, n)).clip(6, 18).tolist()},
    ]

    for cd in curves_def:
        vals = cd["gen"]()
        # Add some null values
        null_indices = np.random.choice(n, size=int(n*0.02), replace=False)
        vals_with_nulls = [None if i in null_indices else v for i, v in enumerate(vals)]

        c = Curve(
            well_id=well.id, mnemonic=cd["mnemonic"],
            unit=cd["unit"], description=cd["desc"],
            data={"depths": depths, "values": vals_with_nulls},
            min_value=float(np.nanmin([v for v in vals if v])),
            max_value=float(np.nanmax([v for v in vals if v])),
            mean_value=float(np.nanmean([v for v in vals if v])),
            null_count=len(null_indices),
            is_predicted=False,
        )
        db.add(c)
    db.commit()


def _seed_formation_tops(db, well: Well):
    tops = [
        {"name": "Rustler",       "tvd": 2135,  "color": "#64748B"},
        {"name": "Salado",        "tvd": 2587,  "color": "#3B82F6"},
        {"name": "Castile",       "tvd": 3215,  "color": "#8B5CF6"},
        {"name": "Bell Canyon",   "tvd": 6342,  "color": "#EF4444"},
        {"name": "Cherry Canyon", "tvd": 7505,  "color": "#F59E0B"},
        {"name": "Brushy Canyon", "tvd": 8702,  "color": "#10B981"},
        {"name": "Bone Spring",   "tvd": 9845,  "color": "#F97316"},
        {"name": "1st Bone Spring","tvd": 10912, "color": "#EC4899"},
        {"name": "2nd Bone Spring","tvd": 11862, "color": "#06B6D4"},
        {"name": "3rd Bone Spring","tvd": 12420, "color": "#84CC16"},
    ]
    for t in tops:
        ft = FormationTop(
            well_id=well.id, formation_name=t["name"],
            tvd_ft=float(t["tvd"]), md_ft=float(t["tvd"]) + 5,
            is_ai_detected=False, confidence=None, color_hex=t["color"],
        )
        db.add(ft)
    db.commit()

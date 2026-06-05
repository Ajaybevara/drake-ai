"""Drake AI Enterprise Platform — FastAPI Application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.core.database import engine, Base
from app.core.seed import seed_db
from app.api import auth, projects, wells, curves, files, ai_jobs, reports, gpt, petrophysics, seismic, local_projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed demo data
    Base.metadata.create_all(bind=engine)
    os.makedirs("uploads", exist_ok=True)
    seed_db()
    yield
    # Shutdown cleanup (if needed)


app = FastAPI(
    title="Drake AI Enterprise API",
    description="Petrophysics Intelligence Platform — API",
    version="2.4.1",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving (uploads) ────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── API Routers ───────────────────────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(wells.router,    prefix="/api/wells",    tags=["Wells"])
app.include_router(curves.router,   prefix="/api/curves",   tags=["Curves"])
app.include_router(files.router,    prefix="/api/files",    tags=["Files"])
app.include_router(ai_jobs.router,  prefix="/api/ai",       tags=["AI Jobs"])
app.include_router(reports.router,  prefix="/api/reports",  tags=["Reports"])
app.include_router(gpt.router,      prefix="/api/gpt",      tags=["Drake GPT"])
app.include_router(petrophysics.router, prefix="/api/petrophysics", tags=["Petrophysics"])
app.include_router(seismic.router,  prefix="/api/seismic",  tags=["Seismic"])
app.include_router(local_projects.router, prefix="/api/local-projects", tags=["Local Projects"])


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "version": "2.4.1", "platform": "Drake AI Enterprise"}

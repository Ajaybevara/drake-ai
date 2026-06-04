"""Drake AI — SQLAlchemy ORM Models"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


# ── Enums ──────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    admin = "admin"
    petrophysicist = "petrophysicist"
    geologist = "geologist"
    reservoir_engineer = "reservoir_engineer"
    data_scientist = "data_scientist"
    viewer = "viewer"


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobType(str, enum.Enum):
    missing_log = "missing_log"
    facies = "facies"
    formation_tops = "formation_tops"
    porosity = "porosity"
    permeability = "permeability"
    water_saturation = "water_saturation"
    auto_splice = "auto_splice"


# ── User ────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.petrophysicist)
    is_active = Column(Boolean, default=True)
    avatar_initials = Column(String(4), default="U")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    projects = relationship("Project", back_populates="owner")
    ai_jobs = relationship("AIJob", back_populates="created_by_user")


# ── Project ──────────────────────────────────────────────────────────────────
class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    field_name = Column(String(255))
    basin = Column(String(255))
    country = Column(String(100))
    operator = Column(String(255))
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="projects")
    wells = relationship("Well", back_populates="project", cascade="all, delete-orphan")


# ── Well ─────────────────────────────────────────────────────────────────────
class Well(Base):
    __tablename__ = "wells"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    api_number = Column(String(50))
    operator = Column(String(255))
    field = Column(String(255))
    county = Column(String(255))
    state = Column(String(100))
    country = Column(String(100), default="USA")
    kb_elevation = Column(Float)  # ft
    total_depth = Column(Float)   # ft
    top_depth = Column(Float)
    base_depth = Column(Float)
    depth_uom = Column(String(10), default="ft")
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String(50), default="Active")
    uwi = Column(String(100))
    spud_date = Column(String(20))
    completion_date = Column(String(20))
    metadata_json = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="wells")
    curves = relationship("Curve", back_populates="well", cascade="all, delete-orphan")
    files = relationship("WellFile", back_populates="well", cascade="all, delete-orphan")
    ai_jobs = relationship("AIJob", back_populates="well")
    formation_tops = relationship("FormationTop", back_populates="well", cascade="all, delete-orphan")


# ── Curve ─────────────────────────────────────────────────────────────────────
class Curve(Base):
    __tablename__ = "curves"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"), nullable=False)
    mnemonic = Column(String(50), nullable=False)
    unit = Column(String(30))
    description = Column(String(255))
    data = Column(JSON)          # {depths: [...], values: [...]}
    min_value = Column(Float)
    max_value = Column(Float)
    mean_value = Column(Float)
    null_count = Column(Integer, default=0)
    is_predicted = Column(Boolean, default=False)
    source_file_id = Column(Integer, ForeignKey("well_files.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    well = relationship("Well", back_populates="curves")
    source_file = relationship("WellFile", back_populates="curves")


# ── WellFile ──────────────────────────────────────────────────────────────────
class WellFile(Base):
    __tablename__ = "well_files"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    original_name = Column(String(500))
    file_type = Column(String(20))   # LAS, DLIS, PDF, CSV, XLSX, TIFF
    file_size = Column(Integer)      # bytes
    storage_path = Column(String(1000))
    is_processed = Column(Boolean, default=False)
    curve_count = Column(Integer, default=0)
    depth_start = Column(Float)
    depth_end = Column(Float)
    depth_step = Column(Float)
    metadata_json = Column(JSON, default={})
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    well = relationship("Well", back_populates="files")
    curves = relationship("Curve", back_populates="source_file")


# ── FormationTop ──────────────────────────────────────────────────────────────
class FormationTop(Base):
    __tablename__ = "formation_tops"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"), nullable=False)
    formation_name = Column(String(255), nullable=False)
    tvd_ft = Column(Float)
    md_ft = Column(Float)
    is_ai_detected = Column(Boolean, default=False)
    confidence = Column(Float)
    color_hex = Column(String(10), default="#64748B")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    well = relationship("Well", back_populates="formation_tops")


# ── AIJob ─────────────────────────────────────────────────────────────────────
class AIJob(Base):
    __tablename__ = "ai_jobs"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"), nullable=False)
    job_type = Column(SAEnum(JobType), nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.pending)
    created_by = Column(Integer, ForeignKey("users.id"))
    progress = Column(Float, default=0.0)
    accuracy = Column(Float)
    confidence = Column(String(20))
    model_name = Column(String(100), default="Drake AI-ML v2.3")
    parameters = Column(JSON, default={})
    result = Column(JSON, default={})
    error_message = Column(Text)
    predicted_curves = Column(JSON, default=[])
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    well = relationship("Well", back_populates="ai_jobs")
    created_by_user = relationship("User", back_populates="ai_jobs")


# ── Report ────────────────────────────────────────────────────────────────────
class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    well_id = Column(Integer, ForeignKey("wells.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(500), nullable=False)
    report_type = Column(String(50))   # petrophysics, executive, ai_summary
    file_path = Column(String(1000))
    format = Column(String(10))        # PDF, DOCX, PPTX, LAS
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

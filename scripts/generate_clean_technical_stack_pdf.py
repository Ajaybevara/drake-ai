from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "drake_ai_clean_technical_stack.pdf"


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "CleanTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111827"),
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "CleanSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "CleanHeading",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#dc2626"),
            spaceBefore=12,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "CleanBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "CleanSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=12,
            textColor=colors.HexColor("#334155"),
        ),
    }


S = make_styles()


def para(text, style="body"):
    safe = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(safe, S[style])


def clean_table(rows, widths):
    table = Table([[para(cell, "small") for cell in row] for row in rows], colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d1d5db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(0.55 * inch, 0.35 * inch, "Drake AI - clean technical stack")
    canvas.drawRightString(7.7 * inch, 0.35 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        title="Drake AI Clean Technical Stack",
    )

    story = [
        para("Drake AI Enterprise Platform", "title"),
        para("Clean technical stack summary for modules, result models, and UI.", "subtitle"),
        para("Project Overview", "h1"),
        para("Drake AI is a full-stack petroleum intelligence platform. The frontend is a React/Vite web app. The backend is a FastAPI Python API. Data workflows include LAS processing, petrophysics, seismic enhancement, CCUS screening, geothermal screening, production intelligence, reports, and an AI copilot."),
        Spacer(1, 8),
        clean_table(
            [
                ["Layer", "Technology Used"],
                ["Frontend", "React 18, TypeScript, Vite, Tailwind CSS, React Router, Zustand, TanStack Query"],
                ["Backend", "FastAPI, Python, Pydantic, SQLAlchemy, Alembic"],
                ["Database", "SQLite for local default, PostgreSQL 15 in Docker"],
                ["Cache", "Redis for session/cache support, with local fallback"],
                ["Storage", "Local uploads plus MinIO/S3-compatible configuration"],
                ["Containers", "Docker and Docker Compose"],
                ["Visualization", "Plotly, Recharts, custom React tables and dashboards"],
                ["AI/ML", "scikit-learn, XGBoost optional, TensorFlow/Keras, PyWavelets, NumPy, pandas, SciPy"],
            ],
            [1.7 * inch, 5.5 * inch],
        ),
        Spacer(1, 12),
        para("Models Used For Results", "h1"),
        clean_table(
            [
                ["Result Area", "Model / Method Used"],
                ["Drake GPT Copilot", "Anthropic Claude Sonnet 4: claude-sonnet-4-20250514. Local rule-based fallback when no API key is configured."],
                ["Missing Log Prediction", "Extra Trees, Random Forest, and Gradient Boosting regressors."],
                ["AI Parameter Prediction", "Empirical formulas, Random Forest AI, XGBoost AI, Gradient Boosting AI, and Decision Tree AI."],
                ["AI Uncertainty", "P10/P50/P90 bands from Random Forest tree spread, bootstrap/ensemble spread, or percent-based fallback."],
                ["Seismic Enhancement", "Conv1D U-Net, PyWavelets + Random Forest, Conv1D frequency-band autoencoder, and FFT fallback."],
                ["CCUS Screening", "Rule-based reservoir/seal quality scoring from log-derived PHIE, VSH, permeability, GR, RHOB, NPHI, and RT."],
                ["Geothermal / Production", "Analytical calculations and KPI rules from uploaded data."],
            ],
            [2.0 * inch, 5.2 * inch],
        ),
        PageBreak(),
        para("Module Stack Usage", "h1"),
        clean_table(
            [
                ["Module", "Stack / Usage"],
                ["Auth", "FastAPI, JWT, bcrypt, SQLAlchemy user records."],
                ["Projects / Wells / Curves / Files", "FastAPI APIs, SQLAlchemy, LAS parsing, local uploads, optional MinIO."],
                ["Petrophysics", "lasio, pandas, NumPy, SciPy, Plotly JSON, Redis-backed sessions."],
                ["Missing Logs", "scikit-learn regressors with LAS feature inputs and CSV/LAS exports."],
                ["AI Prediction / Uncertainty", "Random Forest, XGBoost, Gradient Boosting, Decision Tree, empirical petrophysics formulas."],
                ["Facies / Formation Tops", "Petrophysics toolbox logic, clustering/classification style workflows, Plotly responses."],
                ["Seismic", "segyio, TensorFlow/Keras, PyWavelets, Random Forest, FFT, NumPy."],
                ["CCUS", "Custom LAS parser, cutoff rules, quality scoring, Plotly log tracks, XLSX export."],
                ["Geothermal", "LAS screening, pandas, CSV/JSON export, heat-flow map PNG."],
                ["Production", "CSV/XLSX ingestion, pandas analytics, production KPI outputs."],
                ["Reports", "PDF, spreadsheet, CSV/JSON export utilities."],
                ["Standalone Drake_Uncertainity", "Flask, templates, Plotly, lasio, pandas, scikit-learn, optional XGBoost."],
            ],
            [2.0 * inch, 5.2 * inch],
        ),
        Spacer(1, 12),
        para("Complete UI Technical Stack", "h1"),
        clean_table(
            [
                ["UI Part", "Technology"],
                ["App shell", "React 18, TypeScript, Vite, React Router DOM"],
                ["State and data", "Zustand, TanStack Query, Axios, local/session storage"],
                ["Styling", "Tailwind CSS, PostCSS, Autoprefixer, custom CSS and inline component styles"],
                ["Charts", "Plotly.js and Recharts"],
                ["Uploads", "React Dropzone and typed API service wrappers"],
                ["Notifications and icons", "React Hot Toast and lucide-react"],
                ["Main screens", "Dashboard, projects, data management, petrophysics, seismic, production, CCUS, geothermal, reports, settings"],
            ],
            [2.0 * inch, 5.2 * inch],
        ),
        Spacer(1, 10),
        para("Main API Groups", "h1"),
        para("/api/auth, /api/projects, /api/wells, /api/curves, /api/files, /api/ai, /api/reports, /api/gpt, /api/petrophysics, /api/seismic, /api/geothermal, /api/production, and /api/ccus."),
    ]

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build_pdf()
    print(str(OUTPUT).encode("ascii", "backslashreplace").decode("ascii"))

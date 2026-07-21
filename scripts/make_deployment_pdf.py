from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Flowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
PDF_PATH = OUT_DIR / "drake-ai-separate-deployment-guide.pdf"
LOGO_PATH = ROOT / "frontend" / "public" / "logo.png"


class ColorBand(Flowable):
    def __init__(self, width, height, color):
        super().__init__()
        self.width = width
        self.height = height
        self.color = color

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.width, self.height, stroke=0, fill=1)


def p(text, style):
    return Paragraph(text, style)


def code(text, styles):
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe = safe.replace("\n", "<br/>")
    return Paragraph(safe, styles["Code"])


def make_table(rows, col_widths, styles):
    table_rows = []
    for row_index, row in enumerate(rows):
        style = styles["HeaderCell"] if row_index == 0 else styles["Cell"]
        table_rows.append([cell if hasattr(cell, "wrap") else p(str(cell), style) for cell in row])
    table = Table(table_rows, colWidths=col_widths, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1320")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DCE6F2")),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def build_pdf():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
        title="Drake AI Separate Deployment Guide",
    )

    base = getSampleStyleSheet()
    styles = {
        "Title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=colors.HexColor("#0B1320"),
            alignment=TA_CENTER,
            spaceAfter=10,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#48617F"),
            alignment=TA_CENTER,
            spaceAfter=16,
        ),
        "H1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#0B1320"),
            spaceBefore=10,
            spaceAfter=8,
        ),
        "H2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#D62828"),
            spaceBefore=8,
            spaceAfter=6,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#122033"),
            spaceAfter=6,
        ),
        "Cell": ParagraphStyle(
            "Cell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=11,
            textColor=colors.HexColor("#122033"),
        ),
        "HeaderCell": ParagraphStyle(
            "HeaderCell",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=11,
            textColor=colors.white,
        ),
        "Code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=7.4,
            leading=10,
            textColor=colors.HexColor("#F8FAFC"),
            backColor=colors.HexColor("#0B1320"),
            borderPadding=7,
            leftIndent=0,
            rightIndent=0,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "Small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#48617F"),
            alignment=TA_LEFT,
        ),
    }

    story = []
    if LOGO_PATH.exists():
        story.append(Image(str(LOGO_PATH), width=1.45 * inch, height=0.72 * inch, hAlign="CENTER"))
        story.append(Spacer(1, 6))
    story.append(p("Drake AI Separate Deployment Guide", styles["Title"]))
    story.append(
        p(
            "Simple production setup for separate Admin Dashboard, User Dashboard, shared Backend API, shared PostgreSQL database, and Drake AI Digitizer endpoints.",
            styles["Subtitle"],
        )
    )
    story.append(ColorBand(7.1 * inch, 0.08 * inch, colors.HexColor("#D62828")))
    story.append(Spacer(1, 12))

    story.append(p("1. Final Production Architecture", styles["H1"]))
    story.append(
        make_table(
            [
                ["Domain", "What It Runs", "Important Point"],
                ["https://admin.your-domain.com", "Admin dashboard only", "Admin creates users, passwords, module access, and views user activity."],
                ["https://user.your-domain.com", "User dashboard only", "Users login with credentials created by admin."],
                ["https://api.your-domain.com", "FastAPI backend", "Both dashboards must use this same API."],
                ["PostgreSQL", "Shared database", "Stores users, access modules, projects, results, and activity history."],
            ],
            [1.9 * inch, 1.75 * inch, 3.2 * inch],
            styles,
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        p(
            "Production rule: admin and user dashboards are separate builds, but they must connect to the same backend API and database.",
            styles["Body"],
        )
    )

    story.append(p("2. Files You Need To Edit", styles["H1"]))
    story.append(
        make_table(
            [
                ["File", "Use"],
                ["env/deployment/.env.production.example", "Root Docker production stack env. Copy to .env for docker-compose.prod.yml."],
                ["env/backend/.env.production.example", "Backend-only production env. Copy to env/backend/.env for direct backend deployment."],
                ["env/backend/.env.digitizer.production.example", "Digitizer SLM/GPT and OCR model endpoint reference."],
                ["env/frontend/.env.user.production.example", "User dashboard build env."],
                ["env/frontend/.env.admin.production.example", "Admin dashboard build env."],
                ["docker-compose.prod.yml", "Full production stack: backend, database, redis, MinIO, user frontend, admin frontend, nginx."],
            ],
            [2.5 * inch, 4.35 * inch],
            styles,
        )
    )

    story.append(PageBreak())
    story.append(p("3. Backend .env", styles["H1"]))
    story.append(p("Copy this file:", styles["Body"]))
    story.append(code("env/backend/.env.production.example  ->  env/backend/.env", styles))
    story.append(p("Required values:", styles["Body"]))
    story.append(
        code(
            """DATABASE_URL=postgresql://drakeai:YOUR_DB_PASSWORD@YOUR_DB_HOST:5432/drakeai
REDIS_URL=redis://YOUR_REDIS_HOST:6379/0
SECRET_KEY=YOUR_LONG_RANDOM_SECRET
ADMIN_USERNAME=Drake6105
ADMIN_PASSWORD=YOUR_STRONG_ADMIN_PASSWORD
CORS_ORIGINS=["https://user.your-domain.com","https://admin.your-domain.com"]""",
            styles,
        )
    )

    story.append(p("4. Digitizer Endpoints", styles["H1"]))
    story.append(p("Add these values in env/backend/.env. You can change these later without changing code.", styles["Body"]))
    story.append(
        code(
            """VLLM_API_KEY=EMPTY
VLLM_CHAT_BASE_URL=http://your-vllm-chat-server:8000/v1
VLLM_EMBEDDING_BASE_URL=http://your-embedding-server:8001/v1
VLLM_OCR_BASE_URL=http://your-ocr-vllm-server:8700/v1
LLM_MODEL=qwen2.5-7b-instruct
VLLM_OCR_MODEL=qwen2.5-vl-7b
VLLM_TIMEOUT_SECONDS=120""",
            styles,
        )
    )
    story.append(
        p(
            "If VLLM_OCR_BASE_URL is not running, Drake OCR still uses the installed local RapidOCR fallback for image/PDF OCR.",
            styles["Body"],
        )
    )

    story.append(p("5. Deploy Backend", styles["H1"]))
    story.append(code("cd backend\nalembic upgrade head\npython -c \"from app.core.seed import seed_db; seed_db()\"\nuvicorn app.main:app --host 0.0.0.0 --port 8000", styles))

    story.append(p("6. Deploy User Dashboard Separately", styles["H1"]))
    story.append(p("Use user mode. This build does not expose admin routes as the main portal.", styles["Body"]))
    story.append(code("cd frontend\nVITE_PORTAL_MODE=user VITE_API_URL=https://api.your-domain.com npm run build", styles))
    story.append(p("Deploy frontend/dist to:", styles["Body"]))
    story.append(code("https://user.your-domain.com", styles))
    story.append(p("User URLs:", styles["Body"]))
    story.append(code("https://user.your-domain.com/login\nhttps://user.your-domain.com/dashboard", styles))

    story.append(p("7. Deploy Admin Dashboard Separately", styles["H1"]))
    story.append(p("Use admin mode. This build is only for admin login and admin dashboard.", styles["Body"]))
    story.append(code("cd frontend\nVITE_PORTAL_MODE=admin VITE_API_URL=https://api.your-domain.com npm run build", styles))
    story.append(p("Deploy frontend/dist to:", styles["Body"]))
    story.append(code("https://admin.your-domain.com", styles))
    story.append(p("Admin URLs:", styles["Body"]))
    story.append(code("https://admin.your-domain.com/admin-login\nhttps://admin.your-domain.com/admin", styles))

    story.append(PageBreak())
    story.append(p("8. Docker Deployment Option", styles["H1"]))
    story.append(code("cp env/deployment/.env.production.example env/deployment/.env.production\ndocker compose --env-file env/deployment/.env.production -f docker-compose.prod.yml up --build -d", styles))
    story.append(
        p(
            "Use docker-compose.user.yml and docker-compose.admin.yml only when deploying the frontend dashboards separately from the backend server.",
            styles["Body"],
        )
    )

    story.append(p("9. Database Tables Used", styles["H1"]))
    story.append(
        make_table(
            [
                ["Table", "Purpose"],
                ["users", "Admin account and all admin-created user credentials."],
                ["users.access_modules", "List of modules each user can open."],
                ["user_activities", "Login/logout activity shown in admin dashboard."],
                ["projects, wells, well_files, curves", "Project and uploaded data records."],
                ["ai_jobs, reports", "Generated results and reports."],
            ],
            [2.35 * inch, 4.5 * inch],
            styles,
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        p(
            "Admin-created credentials work in user login because both dashboards use the same VITE_API_URL and the backend uses the same DATABASE_URL.",
            styles["Body"],
        )
    )

    story.append(p("10. Final Checklist", styles["H1"]))
    story.append(
        make_table(
            [
                ["Check", "Value"],
                ["Admin frontend", "VITE_PORTAL_MODE=admin"],
                ["User frontend", "VITE_PORTAL_MODE=user"],
                ["Both frontends", "Same VITE_API_URL"],
                ["Backend", "Same DATABASE_URL"],
                ["CORS", "Includes both admin and user domains"],
                ["Secrets", "Replace all CHANGE_THIS placeholders before deployment"],
            ],
            [2.35 * inch, 4.5 * inch],
            styles,
        )
    )

    def footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#48617F"))
        canvas.drawString(0.55 * inch, 0.3 * inch, "Drake AI Enterprise Platform")
        canvas.drawRightString(A4[0] - 0.55 * inch, 0.3 * inch, f"Page {doc_obj.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build_pdf()
    print("output/pdf/drake-ai-separate-deployment-guide.pdf")

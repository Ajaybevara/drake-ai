# Drake AI Enterprise Platform

A full-stack petrophysics intelligence platform — Petrel + TechLog + AI Copilot.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python 3.11) |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| File Storage | MinIO (S3-compatible) |
| AI/ML | scikit-learn, lasio, welly |
| Auth | JWT + bcrypt |
| Containerization | Docker + Docker Compose |

## Quick Start (Docker — recommended)

```bash
git clone <repo>
cd drake-ai
cp .env.example .env          # edit secrets
docker compose up --build -d
# App:      http://localhost:3000
# API docs: http://localhost:8000/docs
# MinIO:    http://localhost:9001
```

## Manual Setup

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
```

### PostgreSQL
```bash
createdb drakeai
# Update DATABASE_URL in backend/.env
```

## Default Login
- Email: `admin@drakeai.com`
- Password: `Drake@2024`

## API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc:      http://localhost:8000/redoc

## Project Structure
```
drake-ai/
├── backend/          # FastAPI Python backend
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── core/     # Config, security, DB
│   │   ├── models/   # SQLAlchemy ORM models
│   │   ├── services/ # Business logic
│   │   └── ml/       # AI/ML modules
│   ├── migrations/   # Alembic migrations
│   └── requirements.txt
├── frontend/         # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/ # API client
│   │   └── store/    # Zustand state
│   └── package.json
└── docker/           # Docker configs
```

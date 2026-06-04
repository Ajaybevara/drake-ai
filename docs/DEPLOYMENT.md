# Drake AI Enterprise Platform — Deployment Guide

## ══ OPTION 1: Docker Compose (Recommended) ══════════════════════════

### Prerequisites
- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)
- 8 GB RAM minimum, 16 GB recommended
- 20 GB disk space

### Steps

```bash
# 1. Clone / extract the project
cd drake-ai

# 2. Copy environment files
cp .env.example .env
cp frontend/.env.example frontend/.env

# 3. Edit .env — set your Anthropic API key (optional, enables Drake GPT)
#    ANTHROPIC_API_KEY=sk-ant-...

# 4. Start all services
docker compose up --build -d

# 5. Check logs
docker compose logs -f backend

# 6. Access the application
#    Frontend:  http://localhost:3000
#    API Docs:  http://localhost:8000/docs
#    MinIO:     http://localhost:9001  (user: drakeai_minio / drakeai_minio_secret)
```

### Default Login
| Field    | Value               |
|----------|---------------------|
| Email    | admin@drakeai.com   |
| Password | Drake@2024          |

### Stop / Restart
```bash
docker compose down          # stop
docker compose down -v       # stop + delete data volumes
docker compose restart       # restart all
docker compose restart backend  # restart only backend
```

---

## ══ OPTION 2: Manual Local Setup ═══════════════════════════════════

### A. Database (PostgreSQL 15)

**Windows:** Download from https://www.postgresql.org/download/windows/
**Mac:** `brew install postgresql@15 && brew services start postgresql@15`
**Linux:** `sudo apt install postgresql-15`

```sql
-- Connect as postgres superuser then run:
CREATE DATABASE drakeai;
CREATE USER drakeai WITH PASSWORD 'drakeai_secret';
GRANT ALL PRIVILEGES ON DATABASE drakeai TO drakeai;
```

### B. Redis (optional — for caching)

**Windows:** https://github.com/microsoftarchive/redis/releases
**Mac:** `brew install redis && brew services start redis`
**Linux:** `sudo apt install redis-server`

### C. Backend (Python 3.11+)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
# OR: venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — update DATABASE_URL if needed

# Run database migrations
alembic upgrade head

# Seed demo data (admin user + sample wells)
python -c "from app.core.seed import seed_db; seed_db()"

# Start the backend
uvicorn app.main:app --reload --port 8000
```

Backend will be available at: http://localhost:8000
Swagger API docs at: http://localhost:8000/docs

### D. Frontend (Node.js 18+)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# VITE_API_URL=http://localhost:8000

# Start development server
npm run dev
```

Frontend will be available at: http://localhost:3000

---

## ══ OPTION 3: Cloud Deployment ════════════════════════════════════

### Render.com (Free Tier)

**Backend:**
1. New Web Service → Connect GitHub repo
2. Root Directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env`

**Frontend:**
1. New Static Site → Connect GitHub repo
2. Root Directory: `frontend`
3. Build Command: `npm install && npm run build`
4. Publish Directory: `dist`
5. Add env: `VITE_API_URL=https://your-backend.onrender.com`

### Railway.app

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login

# Deploy backend
cd backend
railway init
railway up

# Deploy frontend
cd ../frontend
railway init
railway up
```

### AWS / Azure / GCP (Production)

Use `docker-compose.prod.yml`:

```bash
# Set production secrets
export POSTGRES_PASSWORD=your_strong_password
export SECRET_KEY=your_64_char_random_string
export ANTHROPIC_API_KEY=sk-ant-...

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

---

## ══ API REFERENCE ═══════════════════════════════════════════════

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/login` | POST | Login → JWT token |
| `/api/auth/register` | POST | Register new user |
| `/api/auth/me` | GET | Current user info |
| `/api/projects/` | GET/POST | List / create projects |
| `/api/projects/{id}` | GET/DELETE | Get / delete project |
| `/api/wells/project/{id}` | GET | List wells in project |
| `/api/wells/` | POST | Create well |
| `/api/wells/{id}` | GET/DELETE | Get / delete well |
| `/api/curves/well/{id}` | GET | List curves for well |
| `/api/curves/{id}/data` | GET | Get curve data (depths + values) |
| `/api/files/upload/{well_id}` | POST | Upload LAS/DLIS/CSV file |
| `/api/files/well/{id}` | GET | List files for well |
| `/api/ai/run` | POST | Run AI petrophysics module |
| `/api/ai/well/{id}` | GET | List AI jobs for well |
| `/api/ai/{id}` | GET | Poll job status + progress |
| `/api/gpt/chat` | POST | Drake GPT chat |
| `/api/reports/generate` | POST | Generate PDF/LAS report |

### AI Module Types
```
missing_log         → Missing Log Prediction (LSTM + RF)
facies              → Facies Classification (Random Forest)
formation_tops      → Formation Tops Detection (CNN)
porosity            → Effective Porosity (GBM)
permeability        → Permeability (RF + FZI)
water_saturation    → Water Saturation (Archie + NN)
auto_splice         → Auto Splice (depth-match merge)
```

---

## ══ ADDING ANTHROPIC API KEY ════════════════════════════════════

Drake GPT uses Claude claude-sonnet-4-20250514 for real AI responses.

1. Get API key from https://console.anthropic.com
2. Add to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
3. Restart backend: `docker compose restart backend`

Without an API key, Drake GPT uses rule-based petrophysics responses (still works).

---

## ══ TROUBLESHOOTING ══════════════════════════════════════════════

**DB connection fails:**
```bash
docker compose logs postgres
# Check DATABASE_URL in .env matches postgres container credentials
```

**Backend won't start:**
```bash
docker compose logs backend
# Usually a missing package or DB not ready
```

**Frontend can't reach API:**
```bash
# Check VITE_API_URL in frontend/.env
# Ensure backend is running: curl http://localhost:8000/api/health
```

**LAS file parse fails:**
```bash
# Check file encoding — lasio supports LAS 1.2 and 2.0
# Null value issues: lasio auto-detects -9999.25 and -999.25
```

**Reset everything:**
```bash
docker compose down -v
docker compose up --build -d
```

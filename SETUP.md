# Setup Guide — Society Maintenance & Expense Tracker

## Prerequisites
- Docker Desktop (recommended) **or** Node 20 + Python 3.12 + PostgreSQL 16

---

## Option A — Docker (easiest)

```bash
docker-compose up --build
```

The first run will:
1. Start PostgreSQL
2. Run Alembic migrations (creates all tables + append-only guardrail)
3. Start the FastAPI backend on http://localhost:8000
4. Start the React dev server on http://localhost:5173

**Create the first Treasurer account** (one-time bootstrap):
```bash
curl -X POST "http://localhost:8000/auth/setup-treasurer?name=Treasurer+Name&contact=treasurer@email.com&password=yourpassword"
```

Open **http://localhost:5173** and log in.

---

## Option B — Local (without Docker)

### 1. Database
Create a Postgres database named `society_db`.

### 2. Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Copy and edit env
cp ../.env.example .env
# Edit DATABASE_URL in .env

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

**Bootstrap the Treasurer:**
```
POST http://localhost:8000/auth/setup-treasurer
  ?name=D. Rao
  &contact=drao@society.com
  &password=secret123
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## API Documentation
FastAPI auto-generates Swagger UI: **http://localhost:8000/docs**

---

## First steps after login (as Treasurer)

1. **Add units**: Go to Administration → Units → "＋ Add unit"
2. **Raise charges**: Go to Maintenance → "＋ Raise charges (cycle)"
3. **Record payments**: Go to Maintenance → "＋ Record payment"
4. **Record expenses**: Go to Expenses → "＋ Record transaction"

The Secretary can approve new member registrations via Administration → Approvals.

---

## Architecture summary
```
React SPA (Vite)  ──/api proxy──▶  FastAPI (Python)  ──SQLAlchemy──▶  PostgreSQL
  :5173                              :8000                               :5432
```

- Money: `NUMERIC(12,2)` in DB · `Decimal` in Python · string in JSON · displayed with `toLocaleString`
- Ledger is append-only — no UPDATE/DELETE on transactions
- JWT carries role + can_approve; all authorization is server-side

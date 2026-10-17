# AI-Powered SOC Assistant Using Large Language Models

An academic research prototype that assists SOC analysts in understanding and
investigating security alerts. Alerts are normalized from a Wazuh-compatible
source, enriched with a security context, and analyzed by a local LLM
(Qwen3-8B via Ollama) under three controlled modes — including an
evidence-aware RAG pipeline that cites MITRE ATT&CK and NVD/CVE knowledge with
validated evidence references.

**This is research software, not a production SOC.**
- This is NOT a SIEM and NOT a replacement for a security analyst.
- The AI analysis is advisory only — a human analyst makes the final decision.
- The system performs no automated remediation.

## What is real vs. development-only (honesty inventory)

| Area | State |
|---|---|
| FastAPI backend, PostgreSQL, Alembic | IMPLEMENTED AND VERIFIED |
| Security context extraction | IMPLEMENTED AND VERIFIED |
| Semantic embeddings (MiniLM-L6-v2, 384-dim) | IMPLEMENTED AND VERIFIED |
| Qdrant knowledge index (MITRE 1618 chunks + NVD 144 chunks) | IMPLEMENTED AND VERIFIED |
| Ollama Qwen3-8B analysis (3 modes) | IMPLEMENTED AND VERIFIED |
| Evidence-reference validation | IMPLEMENTED AND VERIFIED |
| Evaluation runner + 10-case dataset | IMPLEMENTED (results recorded in `backend/evaluation/results/`) |
| Real Wazuh client (JWT auth protocol) | IMPLEMENTED — LIVE INGESTION **NOT VERIFIED** (no real Wazuh instance available) |
| Mock Wazuh client | Dev-only; alerts from it are explicitly labeled as development data |
| Analyst feedback persistence | PLANNED (schema exists, no endpoint/UI yet) |

The frontend never silently falls back to mock data: an API failure renders a
visible error with retry, and zero records render a real empty state.

## Architecture

```
Wazuh (or labeled mock client)
   → normalization → PostgreSQL
   → security context → retrieval queries
   → semantic embedding → Qdrant (MITRE ATT&CK + NVD/CVE)
   → evidence set → Qwen3-8B (Ollama)
   → evidence-reference validation → PostgreSQL analysis
   → FastAPI → React frontend
```

## Repository structure

- `backend/` — FastAPI app, DB models/migrations, Wazuh integration, RAG/LLM pipeline, evaluation runner
- `frontend/` — React + TypeScript + Vite UI (dark theme)
- `backend/knowledge/` — local source data: `enterprise-attack.json`, `nvd-cves.json` (NOT committed; rebuilt via scripts)
- `backend/evaluation/` — dataset + timestamped result runs

## Required services

- Docker & Docker Compose (for the 1-command setup)
- Ollama with `qwen3:8b` (`ollama pull qwen3:8b`)
- *(Optional for manual setup without Docker: Python 3.11+, Node 18+, PostgreSQL 15+, Qdrant v1.18)*

---

## Quick Start / How to Run the Project

### Method 1: One-Command Docker Setup (Recommended for Teams)

To start the **entire application** (PostgreSQL, Qdrant, FastAPI Backend, and React Frontend) with **one command**:

#### 1. Prerequisites (Host Machine)
Ensure Ollama is running on your machine with `qwen3:8b`:
```powershell
ollama serve                             # if not already running as a service
ollama pull qwen3:8b
```

#### 2. Run the Stack
From the repository root:
```powershell
docker compose up --build
```

**That's it! Everything happens automatically:**
- **PostgreSQL (`soc_db`)** and **Qdrant (`soc_qdrant`)** start up with healthchecks.
- **FastAPI Backend (`soc_backend`)**:
  - Waits for database readiness
  - Automatically runs Alembic migrations (`alembic upgrade head`)
  - Automatically indexes MITRE ATT&CK & NVD knowledge into Qdrant if collection is empty
  - Automatically syncs initial development alerts into PostgreSQL
  - Connects to Ollama running on your host machine via `host.docker.internal`
- **React Frontend (`soc_frontend`)** starts on `http://localhost:5173`.

**Access the Application:**
- **Web UI**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

To stop all services:
```powershell
docker compose down
```

---

### Method 2: Manual Local Development (Multi-Terminal)

If you prefer running the backend and frontend directly in your local environment without containers:

#### Step 1: Start Background Services
Open a terminal at the repository root:

```powershell
# 1. Start Qdrant vector database (and optionally PostgreSQL if you don't run local Postgres)
docker compose up -d qdrant

# If you prefer running PostgreSQL via Docker instead of a native Windows service:
# docker compose up -d db

# 2. Start Ollama and ensure the Qwen3-8B model is pulled
ollama serve                             # Run if Ollama is not already running as a system service
ollama pull qwen3:8b
```

#### Step 2: Configure Environment Variables
Create `backend/.env` from `.env.example` if you haven't already:

- **PowerShell**:
  ```powershell
  Copy-Item backend\.env.example backend\.env
  ```
- **Command Prompt (CMD)**:
  ```cmd
  copy backend\.env.example backend\.env
  ```
- **Git Bash / Linux / macOS**:
  ```bash
  cp backend/.env.example backend/.env
  ```

> [!NOTE]
> By default `backend/.env` is set to `WAZUH_MODE=mock`, `QDRANT_URL=http://localhost:6333`, and `LLM_BASE_URL=http://localhost:11434`.
> Check your `DATABASE_URL` in `backend/.env`:
> - If using a native Windows PostgreSQL service: `postgresql+asyncpg://soc_user:soc_password@localhost:5432/soc_assistant`
> - If using Docker Compose `db` container: `postgresql+asyncpg://soc_user:soc_password@localhost:5432/soc_db`

#### Step 3: Setup & Run the Backend (FastAPI)
Open a **new terminal** and navigate to `backend/`.

##### Option A: Direct venv execution (Recommended on Windows — avoids script execution policy issues)
```powershell
cd backend


# Create virtual environment (only needed the first time)
python -m venv venv

# Install dependencies
.\venv\Scripts\python.exe -m pip install -r requirements.txt

# Run database migrations (ensures tables are created)
.\venv\Scripts\alembic.exe upgrade head

# Start backend server
.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

##### Option B: With virtual environment activation
- **PowerShell**:
  ```powershell
  cd backend
  # If PowerShell blocks script execution, run this once:
  # Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
  .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  alembic upgrade head
  uvicorn app.main:app --reload --port 8000
  ```
- **Command Prompt (CMD)**:
  ```cmd
  cd backend
  venv\Scripts\activate.bat
  pip install -r requirements.txt
  alembic upgrade head
  uvicorn app.main:app --reload --port 8000
  ```
- **Git Bash / Linux / macOS**:
  ```bash
  cd backend
  source venv/Scripts/activate          # or source venv/bin/activate on Linux/macOS
  pip install -r requirements.txt
  alembic upgrade head
  uvicorn app.main:app --reload --port 8000
  ```

The backend API will be live at: **http://localhost:8000** (Interactive docs at **http://localhost:8000/docs**).

> [!TIP]
> **Why did `uvicorn: The term 'uvicorn' is not recognized` occur?**
> In Windows PowerShell, global commands don't automatically look inside subfolder `venv\Scripts`. You must either activate the virtual environment (`.\venv\Scripts\Activate.ps1`) or call the binary directly with `.\venv\Scripts\uvicorn.exe` or `.\venv\Scripts\python.exe -m uvicorn ...`.

#### Step 4: Populate Data & Knowledge (One-time setup)

While the backend and services are running:

```powershell
# From the backend directory (using venv):
.\venv\Scripts\python.exe scripts\ingest.py

# (Optional) Fetch fresh NVD CVEs and re-index:
# .\venv\Scripts\python.exe scripts\fetch_nvd.py
# .\venv\Scripts\python.exe scripts\ingest.py

# Sync alerts (ingests sample development alerts when WAZUH_MODE=mock)
# PowerShell:
Invoke-RestMethod -Method Post http://localhost:8000/api/v1/alerts/sync

# Or using curl:
# curl -X POST http://localhost:8000/api/v1/alerts/sync
```

#### Step 5: Start the Frontend (React + Vite)

Open a **third terminal**:

```powershell
cd frontend
npm install                              # only needed first time
npm run dev
```

Open your browser at **http://localhost:5173**.

---

### Step 6: Running an Analysis

Open http://localhost:5173 → **AI Analysis** → select an alert →
choose a mode (`llm_only`, `standard_rag`, `evidence_aware`) → **Run Analysis**.
Result, evidence, and provenance are persisted in PostgreSQL before display.

Equivalent API call:

```bash
curl -X POST "http://localhost:8000/api/v1/alerts/1/analyze?mode=evidence_aware"
curl http://localhost:8000/api/v1/alerts/1/analysis
```

### Step 7: Running the Research Evaluation

```powershell
cd backend
.\venv\Scripts\python.exe scripts/run_evaluation.py         # all 10 cases × 3 modes + retrieval ablation
.\venv\Scripts\python.exe scripts/run_evaluation.py --limit 1   # quick smoke run
```
Results go to `backend/evaluation/results/<run_id>/` (`results.json`,
`results.csv`, `report.md`) and a `latest.json` pointer. The UI page
**RAG Evaluation** reads the latest completed run via
`GET /api/v1/evaluation/latest` — it never shows theoretical numbers.

### 9. Interpreting metrics

- Technique precision/recall/F1 — exact MITRE-ID match against hand-authored ground truth.
- Severity-band accuracy — band-word agreement with the expected band; coverage is reported (no imputation).
- Valid evidence-reference rate — whether cited evidence IDs resolve to genuinely retrieved records (citation validity ≠ semantic support).
- Retrieval Recall@1/@5, MRR — rank of the first relevant knowledge record.
- Latency — wall and LLM-only seconds, per case.
- The dataset is small and hand-authored: results indicate behavior; they do not establish statistical significance.

## Key API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/alerts` | Real alerts from PostgreSQL |
| `GET /api/v1/alerts/{id}` / `{id}/security-context` | Alert detail / extracted context |
| `POST /api/v1/alerts/{id}/analyze?mode=` | Run the LLM pipeline (one of three modes) |
| `GET /api/v1/alerts/{id}/analysis` | Latest persisted analysis |
| `GET /api/v1/analyses/{id}` / `{id}/evidence` | Persisted analysis + evidence |
| `POST /api/v1/alerts/sync` | Idempotent Wazuh (or mock) sync |
| `GET /api/v1/dashboard/stats` | Real aggregates + service health |
| `GET /api/v1/health` | Bounded per-dependency checks (no secrets) |
| `GET /api/v1/knowledge/search?q=` | Real semantic search over indexed knowledge |
| `GET /api/v1/evaluation/latest` | Latest completed evaluation run |

## Switching from mock to a real Wazuh server

Set in `backend/.env` (never commit it):

```
WAZUH_MODE=real
WAZUH_BASE_URL=https://<wazuh-server>:55000
WAZUH_USERNAME=<user>
WAZUH_PASSWORD=<password>
WAZUH_VERIFY_SSL=false   # only for self-signed lab certificates
```

The real client implements the Wazuh Manager API protocol:
`POST /security/user/authenticate` (HTTP Basic) → JWT token → `Bearer`-authorized
alerts requests, with transparent token refresh on 401. Errors are explicit
(auth/connection/response) and never silently fall back to mock alerts.
Live ingestion has not been verified against a real Wazuh instance.

## Testing

```powershell
# Backend unit tests (198 passed; no external services needed)
cd backend
.\venv\Scripts\python.exe -m pytest tests/ -q

# Frontend tests and build
cd ../frontend
npm test -- --run                        # 13 tests (mocked API)
npm run build                            # strict TypeScript build
```

## Known limitations

- No authentication on the API — local research prototype only; do not expose it to untrusted networks.
- Structured fields (observed indicators, suspected techniques) are not persisted as separate columns; techniques are derived in the UI from evidence document IDs and recorded in evaluation artifacts.
- Analyst decisions recorded in the UI are advisory session notes, not persisted verdicts.
- Live Wazuh ingestion is implemented but not live-verified.
- CORS is open for local development; restrict `allowed_origins` before any shared deployment.

## Troubleshooting

- **`uvicorn: The term 'uvicorn' is not recognized...`** — You are running `uvicorn` in a terminal where the virtual environment is not active. Either:
  - Run with the direct path: `.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000` (or `.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`)
  - Or activate your virtualenv in PowerShell: `.\venv\Scripts\Activate.ps1`
- **PowerShell script execution error (`Activate.ps1 cannot be loaded because running scripts is disabled...`)** — Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` in your PowerShell window, or simply run binaries directly via `.\venv\Scripts\<tool>.exe`.
- **Frontend shows "Could not load alerts" / "Dashboard data unavailable"** — The backend is not running on port 8000; start the backend server from `backend/`.
- **Database connection error / Alembic fails to connect** — Ensure PostgreSQL is running on port 5432 (native Windows service or `docker compose up -d db`), and verify that the database name in `DATABASE_URL` matches your postgres instance (`soc_assistant` for local service, or `soc_db` for docker compose).
- **Qdrant unreachable** — `docker compose up -d qdrant` from the repo root; verify with `curl http://localhost:6333/collections`.
- **Analysis fails with LLM error** — Ensure Ollama is running and the model exists (`ollama list`); the configured model is reported by `GET /api/v1/health`.
- **Embedding dimension mismatch after switching providers** — Re-run `scripts/ingest.py`; it recreates a mismatched collection automatically (the collection is re-populated from the local source files in the same run).

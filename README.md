# AI-Powered SOC Assistant Using Large Language Models

An academic research prototype that assists Security Operations Center (SOC) analysts in triaging, understanding, and investigating security alerts. Alerts are ingested from live Wazuh clusters (or curated demo scenarios), normalized, enriched with host/user/network security context, and analyzed by a local LLM (**Qwen3-8B via Ollama**) under three controlled experimental modes — featuring an **evidence-aware RAG pipeline** that cites MITRE ATT&CK and NVD/CVE knowledge with automated citation-reference validation.

> [!IMPORTANT]
> **This is research software, not an automated production SOC.**
> - **Not a SIEM replacement:** The assistant complements existing SIEM/EDR platforms by summarizing context and mapping techniques.
> - **Human-in-the-loop:** AI findings and severity classifications are advisory; human analysts make all triage decisions.
> - **Zero automated remediation:** The system does not make host changes, modify firewall rules, or perform destructive actions.

---

## What is Real vs. Development-Only (Honesty Inventory)

| Area | Status | Implementation Details |
|---|---|---|
| **FastAPI Backend & Async Database** | **IMPLEMENTED & VERIFIED** | FastAPI, PostgreSQL with `asyncpg`, SQLAlchemy 2.0, Alembic migrations (**226 backend tests passing**). |
| **Security Context Extraction** | **IMPLEMENTED & VERIFIED** | Normalizes Wazuh telemetry into structured IPs, ports, users, process lineage, MITRE techniques, and CVE identifiers. |
| **Semantic Embeddings & Vector DB** | **IMPLEMENTED & VERIFIED** | 384-dimensional dense embeddings using `sentence-transformers/all-MiniLM-L6-v2` stored in **Qdrant** (1,618 MITRE ATT&CK + 144 NVD/CVE chunks). |
| **Local LLM Reasoning (3 Modes)** | **IMPLEMENTED & VERIFIED** | Ollama with `qwen3:8b` (zero-temperature, prompt injection defense, strict JSON schema output). Supports `llm_only`, `standard_rag`, and `evidence_aware` modes. |
| **Evidence Validation & Provenance** | **IMPLEMENTED & VERIFIED** | Cross-references cited evidence IDs against genuine retrieved knowledge chunks; flags and suppresses hallucinated citations. |
| **Live Pipeline Tracing & Observability** | **IMPLEMENTED & VERIFIED** | Real-time Server-Sent Events (SSE) streaming (`/analyze/stream`), stage-by-stage timing waterfall, live elapsed timer, and historical trace replay. |
| **Interactive Attack & Entity Graph** | **IMPLEMENTED & VERIFIED** | Obsidian-style graph canvas (60fps pan/zoom, collision dispersion, zoom-adaptive node sizing) linking Alerts, Hosts, Users, IPs, Rules, MITRE Techniques, and CVEs. |
| **Multi-Data Source Isolation** | **IMPLEMENTED & VERIFIED** | SQL-level source filtering across **Demo** (52 curated scenarios), **Live Wazuh** (Indexer / Manager), and **Dataset Replay**. |
| **Live Wazuh Indexer Connector** | **IMPLEMENTED & READY** | Direct read-only OpenSearch client (`POST /wazuh-alerts-*/_search`, port 9200) with HTTP Basic Auth and TLS CA bundle support. |
| **Live Wazuh Manager API Connector** | **IMPLEMENTED & READY** | Wazuh Manager REST API client (port 55000) with JWT authentication and transparent 401 token refresh. |
| **40-Case Evaluation Benchmark v2** | **IMPLEMENTED & VERIFIED** | 40 hand-authored scenarios across 10 attack categories (with negative/benign controls), runner resume (`--resume`), ablation tests, and UI dashboard. |
| **React + TypeScript Frontend** | **IMPLEMENTED & VERIFIED** | Dark cybersecurity theme across 9 comprehensive views (**32 frontend tests passing**). Never silently fakes data: shows explicit error/retry on API failures. |

---

## System Architecture

```
[ Data Ingestion ]
    ├── Live Wazuh Indexer (OpenSearch :9200) ──┐
    ├── Live Wazuh Manager REST API (:55000) ──┼──> Normalization & Ingestion ──> PostgreSQL
    └── Curated Demo Attack Scenarios (52)  ──┘          │
                                                         ▼
[ Enrichment & Retrieval ]                     Security Context Extraction
                                                         │
                                        ┌────────────────┴────────────────┐
                                        ▼                                 ▼
                             MITRE Technique Query                 NVD / CVE Query
                                        │                                 │
                                        └────────────────┬────────────────┘
                                                         ▼
                                       Semantic Embedding (all-MiniLM-L6-v2, 384-dim)
                                                         │
                                                         ▼
                                       Qdrant Vector DB (Cosine ANN Retrieval)
                                                         │
                                                         ▼
                                        Evidence Assembly & Grounding
                                                         │
[ LLM Inference & Verification ]                         ▼
                                       Prompt Assembly & Anti-Injection Guard
                                                         │
                                                         ▼
                                       Ollama Local LLM (qwen3:8b, temp=0.0)
                                                         │
                                                         ▼
                                       JSON Output Schema Validation
                                                         │
                                                         ▼
                                       Evidence Citation Verification
                                       (Flags & suppresses ungrounded citations)
                                                         │
                                                         ▼
[ Delivery & Observability ]                   PostgreSQL Persistence
                                                         │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         ▼                                       ▼                                       ▼
  Real-time SSE Streaming                FastAPI REST API                        Interactive Graph
 (/alerts/{id}/analyze/stream)         (/alerts, /evaluation, /knowledge)      (Global & Alert Obsidian Graph)
         │                                       │                                       │
         └───────────────────────────────────────┴───────────────────────────────────────┘
                                                 │
                                                 ▼
                                React + Vite Cybersecurity UI (:5173)
```

---

## 10-Stage Analysis Pipeline

When an alert is analyzed in `evidence_aware` mode, the orchestrator executes a 10-stage verifiable pipeline:

1. **Alert Retrieval & Status Check:** Fetches normalized alert from PostgreSQL and verifies processing state.
2. **Security Context Extraction:** Extracts network indicators (source/dest IP, port), host name, operating system, associated user, and rule metadata.
3. **Retrieval Query Formulation:** Builds structured query strings targeting MITRE ATT&CK tactics/techniques and relevant CVE identifiers.
4. **Semantic Vector Embedding:** Encodes query terms into dense 384-dimensional vectors using `all-MiniLM-L6-v2`.
5. **Qdrant Vector Retrieval:** Runs approximate nearest-neighbor cosine similarity search over the 1,762 indexed security chunks.
6. **Evidence Grounding & Deduplication:** Filters candidates by relevance score, deduplicates overlapping findings, and compiles grounded evidence cards.
7. **Prompt Formulation & Injection Defense:** Formats the security context and grounded evidence into strict system instructions enforcing valid JSON output and evidence citations.
8. **Local LLM Inference (Ollama):** Dispatches the prompt to `qwen3:8b` via zero-temperature inference.
9. **Output Parsing & Citation Validation:** Parses model JSON into the Pydantic schema and validates every cited evidence ID against genuine retrieved IDs.
10. **PostgreSQL Persistence & SSE Broadcast:** Commits the analysis, severity assessment, and verified evidence links to PostgreSQL, broadcasting real-time trace events.

---

## Quick Start / How to Run the Project

### Method 1: One-Command Docker Setup (Recommended)

Starts the **entire stack** (PostgreSQL, Qdrant vector store, FastAPI backend, and React frontend) with a single command.

#### 1. Host Prerequisite: Start Ollama with Qwen3-8B
Ensure Ollama is running on your host machine and has the `qwen3:8b` model:
```powershell
ollama serve                             # Run if Ollama is not already running as a service
ollama pull qwen3:8b
```

#### 2. Launch the Stack
From the repository root:
```powershell
docker compose up --build
```

**Automated Container Initialization:**
- **PostgreSQL (`soc_db`)**: Starts on port `5433` (host) to avoid clashing with local Postgres instances on 5432.
- **Qdrant (`soc_qdrant`)**: Starts on port `6333` with persistent volume storage.
- **FastAPI Backend (`soc_backend`)**:
  - Automatically waits for database readiness.
  - Automatically runs Alembic migrations (`alembic upgrade head`).
  - Checks Qdrant index: automatically indexes MITRE ATT&CK & NVD CVE knowledge if collection is empty.
  - Checks alerts database: automatically seeds initial development scenarios if database is empty.
  - Connects to Ollama running on your host machine via `host.docker.internal:11434`.
- **React Frontend (`soc_frontend`)**: Vite dev server starts on `http://localhost:5173`.

#### 3. Access the Application
- **Web UI:** [http://localhost:5173](http://localhost:5173)
- **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

To stop all containers:
```powershell
docker compose down
```

---

### Method 2: Manual Local Development (Multi-Terminal)

If you prefer running services directly on your host:

#### Step 1: Start Background Services
```powershell
# 1. Start Qdrant vector database via Docker:
docker compose up -d qdrant

# 2. Ensure Ollama is running with Qwen3-8B:
ollama serve
ollama pull qwen3:8b

# 3. Ensure PostgreSQL is running on port 5432:
# If you don't run a native Windows PostgreSQL service, start it via Docker:
# docker compose up -d db
```

#### Step 2: Configure Backend Environment
Copy the example environment file:
- **PowerShell:** `Copy-Item backend\.env.example backend\.env`
- **CMD:** `copy backend\.env.example backend\.env`
- **Linux / macOS:** `cp backend/.env.example backend/.env`

> [!NOTE]
> Verify your `DATABASE_URL` in `backend/.env`:
> - Native local PostgreSQL: `postgresql+asyncpg://soc_user:soc_password@localhost:5432/soc_assistant`
> - Docker Compose database: `postgresql+asyncpg://soc_user:soc_password@localhost:5432/soc_db` (or port 5433 if connecting from host)

#### Step 3: Setup & Start Backend (FastAPI)
Open a **new terminal** and navigate to `backend/`:

##### Option A: Direct venv execution (Recommended on Windows — avoids script execution policy issues)
```powershell
cd backend

# Create virtual environment (first time only)
python -m venv venv

# Install dependencies
.\venv\Scripts\python.exe -m pip install -r requirements.txt

# Run database migrations
.\venv\Scripts\alembic.exe upgrade head

# Start API server
.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

##### Option B: With virtual environment activation
- **PowerShell:**
  ```powershell
  cd backend
  # If PowerShell script execution is restricted, run: Set-ExecutionPolicy RemoteSigned -Scope Process
  .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  alembic upgrade head
  uvicorn app.main:app --reload --port 8000
  ```
- **Linux / macOS:**
  ```bash
  cd backend
  source venv/bin/activate
  pip install -r requirements.txt
  alembic upgrade head
  uvicorn app.main:app --reload --port 8000
  ```

#### Step 4: Ingest Knowledge & Seed Scenarios
In another terminal (with backend and Qdrant running):
```powershell
cd backend

# Ingest MITRE ATT&CK & NVD CVE chunks into Qdrant:
.\venv\Scripts\python.exe scripts\ingest.py

# Seed the 52-record demonstration scenarios into PostgreSQL:
.\venv\Scripts\python.exe scripts\seed_demo_scenarios.py

# Or sync alerts via API:
# Invoke-RestMethod -Method Post http://localhost:8000/api/v1/alerts/sync
```

#### Step 5: Start Frontend (React + Vite)
Open a **new terminal**:
```powershell
cd frontend
npm install                              # first time only
npm run dev
```
Open your browser at **http://localhost:5173**.

---

## Connecting a Live Wazuh Instance

The assistant supports connecting to live Wazuh deployments via two secure, read-only connectors.

See [.env.wazuh.example](file:///.env.wazuh.example) for a complete template.

### Option A: Wazuh Indexer (OpenSearch — Preferred for Telemetry)
Queries the Wazuh Indexer cluster directly via OpenSearch REST API on port `9200`. This provides the highest query performance for alert ingestion:

```env
WAZUH_MODE=real
WAZUH_CONNECTOR_TYPE=indexer
WAZUH_INDEXER_URL=https://wazuh-indexer.example.internal:9200
WAZUH_INDEX_PATTERN=wazuh-alerts-*
WAZUH_INDEXER_USERNAME=soc_reader
WAZUH_INDEXER_PASSWORD=YourSecurePasswordHere
WAZUH_VERIFY_SSL=True
WAZUH_CA_BUNDLE=/path/to/root-ca.pem      # Optional custom CA bundle
```

### Option B: Wazuh Manager REST API (Port 55000)
Connects to the Wazuh Manager API using JWT token authentication:

```env
WAZUH_MODE=real
WAZUH_CONNECTOR_TYPE=manager
WAZUH_BASE_URL=https://wazuh-manager.example.internal:55000
WAZUH_USERNAME=soc_api_user
WAZUH_PASSWORD=YourSecurePasswordHere
WAZUH_VERIFY_SSL=True
```

### Data Source Isolation in the UI
The UI header contains an interactive **Data Source Switcher** providing instant isolation between:
1. **Synthetic Demo Scenarios (`demo`):** 52 curated attack scenarios spanning credential dumping, privilege escalation, lateral movement, ransomware, and benign events.
2. **Live Wazuh (`live_wazuh`):** Telemetry ingested from your configured live Wazuh Indexer or Manager instance.
3. **Dataset Replay (`dataset_replay`):** Replayed benchmark and historical incident telemetry.

---

## Application Views & Features

The frontend application provides 9 dedicated operational views:

| View | Route | Description |
|---|---|---|
| **Security Dashboard** | `/` | Real-time overview of critical alert volume, MITRE ATT&CK tactical coverage, service connectivity badges, and data source counters. |
| **Alert Triage** | `/alerts` | Searchable, paginated alert feed with severity badges, MITRE tactic tags, source filtering, and instant one-click analysis launch. |
| **Alert Details** | `/alerts/:id` | Deep dive into full alert telemetry, normalized security context (host, IPs, user, processes), raw JSON viewer, and historical investigations. |
| **AI Investigation** | `/analysis` | Multi-mode AI analysis execution, structured investigation report, verified MITRE/CVE evidence cards, citation confidence score, and analyst review notes. |
| **Execution Traces** | `/traces` | Live Data-Flow Observability Canvas with animated particle signals, SSE real-time streaming, latency waterfall, technical inspector, and execution replay. |
| **Entity Attack Graph** | `/graph` | Obsidian-style interactive 60fps graph correlating Alerts, Hosts, Users, IPs, Rules, MITRE Techniques, and CVEs across scenarios. |
| **RAG Evaluation** | `/evaluation` | Research benchmark metrics dashboard displaying Precision, Recall, F1, Citation Validity, and Latency across modes on benchmark dataset v2. |
| **Security Knowledge** | `/knowledge` | Direct semantic vector search against indexed MITRE ATT&CK techniques (1,618 chunks) and NVD CVE definitions (144 chunks). |
| **Architecture** | `/architecture` | Interactive system architecture diagram, component pipeline breakdown, and research vs. production boundaries. |

---

## AI Analysis Modes Explained

The assistant supports three controlled experimental modes to rigorously evaluate RAG effectiveness:

1. **`llm_only` (Baseline):**
   - The LLM receives only the normalized alert context.
   - Vector retrieval is bypassed completely.
   - Tests model pre-trained parametric knowledge and establishes baseline hallucination rates.

2. **`standard_rag`:**
   - Performs semantic vector retrieval against MITRE ATT&CK and NVD chunks in Qdrant.
   - Retransmits retrieved chunks as context in the prompt.
   - Does not enforce strict evidence citation verification.

3. **`evidence_aware` (Production Research Mode):**
   - Ingests grounded evidence from Qdrant with explicit identifier anchors (`[MITRE:T1059.001]`, `[CVE-2023-38606]`).
   - Enforces a strict JSON contract requiring the model to cite only retrieved evidence IDs.
   - Executes automated post-inference validation: cross-references all cited evidence IDs against genuine candidates, flagging and suppressing ungrounded citations.

### Running an Analysis via API
```bash
# Run synchronous analysis:
curl -X POST "http://localhost:8000/api/v1/alerts/1/analyze?mode=evidence_aware"

# Retrieve latest persisted analysis:
curl http://localhost:8000/api/v1/alerts/1/analysis

# Stream live SSE execution events:
curl -N "http://localhost:8000/api/v1/alerts/1/analyze/stream?mode=evidence_aware"
```

---

## Research Evaluation Benchmark (Dataset v2)

The system includes a versioned **40-case evaluation benchmark** (`backend/evaluation/dataset_v2.json`) covering 10 distinct threat categories:

1. Initial Access & Phishing
2. Execution & Scripting Interpreters
3. Persistence & Scheduled Tasks
4. Privilege Escalation & Token Manipulation
5. Defense Evasion & Process Injection
6. Credential Access & Password Dumping
7. Discovery & Network Scanning
8. Lateral Movement & Remote Services
9. Command and Control (C2)
10. Negative Controls (Benign System Activities)

### Running the Evaluation Runner
```powershell
cd backend

# Run the complete 40-case benchmark (all 3 modes + retrieval ablation):
.\venv\Scripts\python.exe scripts\run_evaluation.py

# Quick smoke test (e.g. first 2 cases):
.\venv\Scripts\python.exe scripts\run_evaluation.py --limit 2

# Resume an interrupted evaluation run:
.\venv\Scripts\python.exe scripts\run_evaluation.py --resume
```

### Evaluation Artifacts
Results are saved to `backend/evaluation/results/<run_id>/`:
- `results.json`: Full machine-readable outputs, prompts, LLM responses, and stage metrics.
- `results.csv`: Tabular metrics for spreadsheet and statistical analysis.
- `report.md`: Markdown summary comparing Precision, Recall, F1, Citation Validity, and Latency across modes.
- `latest.json`: Pointer to the most recent run, read dynamically by the frontend Evaluation Dashboard (`/evaluation`).

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **Data Sources** | | |
| `GET` | `/api/v1/datasources` | Status and record counts for all 3 data sources (`demo`, `live_wazuh`, `dataset_replay`). |
| **Alerts & Investigation** | | |
| `GET` | `/api/v1/alerts` | Paginated alerts with filtering by severity, status, search query `q`, and `source`. |
| `GET` | `/api/v1/alerts/{id}` | Full alert telemetry and normalized event fields. |
| `GET` | `/api/v1/alerts/{id}/security-context` | Extracted host, network indicators, user, and rule context. |
| `POST` | `/api/v1/alerts/{id}/analyze?mode=` | Execute AI analysis under `llm_only`, `standard_rag`, or `evidence_aware` mode. |
| `GET` | `/api/v1/alerts/{id}/analysis` | Most recent persisted analysis for an alert. |
| `POST` | `/api/v1/alerts/sync` | Ingest alerts from configured Wazuh client (live or mock). |
| `POST` | `/api/v1/alerts/seed-demo` | Idempotently seed the 52-record demonstration dataset. |
| `GET` | `/api/v1/alerts/demo-manifest` | Provenance manifest for demonstration scenarios. |
| **Observability & Tracing** | | |
| `GET` | `/api/v1/alerts/{id}/analyze/stream` | **Server-Sent Events (SSE)** streaming live execution trace events. |
| `GET` | `/api/v1/alerts/{id}/pipeline-trace` | Stage durations, component interfaces, waterfall timings, and mode comparisons. |
| **Attack & Entity Graph** | | |
| `GET` | `/api/v1/alerts/{id}/graph` | Alert-centric Obsidian investigation entity graph. |
| `GET` | `/api/v1/alerts/graph/global` | Global environment entity relationship graph across alerts, hosts, and techniques. |
| **Security Knowledge** | | |
| `GET` | `/api/v1/knowledge/search?q=` | Semantic vector search across indexed MITRE ATT&CK and NVD chunks. |
| **Evaluation & Health** | | |
| `GET` | `/api/v1/evaluation/latest` | Read results and metric comparisons from the latest evaluation benchmark run. |
| `GET` | `/api/v1/dashboard/stats` | Aggregated metrics, severity distribution, MITRE matrix, and service health. |
| `GET` | `/api/v1/health` | Per-dependency health check (PostgreSQL, Qdrant, Ollama, Wazuh). |

---

## Testing & Quality Assurance

### Backend Test Suite (Pytest)
The backend features comprehensive unit and integration tests covering normalization, security context extraction, semantic embeddings, Qdrant vector store, Ollama client, orchestrator, SSE streaming, graph generation, and Wazuh indexer:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest tests/ -q
```
**Status: 226 passed, 2 skipped** (all tests run locally without external network dependencies).

### Frontend Test Suite (Vitest)
The frontend includes unit and component integration tests verifying real API interactions, error states, technical inspector interactions, graph rendering, and evaluation toggles:

```powershell
cd frontend
npm test -- --run                        # 32 passed across 8 test suites
npm run build                            # Strict TypeScript compilation check
```

### End-to-End Verification Script
A standalone end-to-end verification script validates database migrations, vector retrieval, live LLM generation, and persistence:
```powershell
cd backend
.\venv\Scripts\python.exe scripts\verify_e2e.py
```

---

## Troubleshooting & FAQ

### 1. `uvicorn: The term 'uvicorn' is not recognized...`
- **Cause:** Running `uvicorn` in a Windows PowerShell session where the virtual environment is not active.
- **Solution:** Call the binary directly using `.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000` or activate your environment via `.\venv\Scripts\Activate.ps1`.

### 2. PowerShell Script Execution Blocked (`Activate.ps1 cannot be loaded...`)
- **Cause:** Windows PowerShell script execution policy defaults to `Restricted`.
- **Solution:** Run this command once in your PowerShell window:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
  ```
  Or run tools directly via `.\venv\Scripts\<tool>.exe`.

### 3. Docker: Ollama Connection Error (`host.docker.internal` unreachable)
- **Cause:** Docker container cannot reach Ollama running on the host machine.
- **Solution:**
  - Verify Ollama is running on your host (`ollama list`).
  - By default, Ollama binds to `127.0.0.1`. If running on Linux or older Docker versions, set `OLLAMA_HOST=0.0.0.0` before running `ollama serve`.
  - In `docker-compose.yml`, `host.docker.internal:host-gateway` is pre-configured for Windows and macOS.

### 4. Database Connection Refused / Port Conflicts
- **Cause:** PostgreSQL port `5432` might already be used by a native Windows service.
- **Solution:** In `docker-compose.yml`, the container database is exposed on host port `5433` (`5433:5432`). If using Docker Compose, set `DATABASE_URL=postgresql+asyncpg://soc_user:soc_password@localhost:5433/soc_db` in your local `.env`.

### 5. Qdrant Dimension Mismatch
- **Cause:** Switching embedding providers or changing models without rebuilding the vector collection.
- **Solution:** Re-run the ingestion script (`.\venv\Scripts\python.exe scripts\ingest.py`). It detects dimension changes, automatically recreates the collection, and re-embeds all knowledge chunks.

### 6. Frontend Displays "Could not load alerts" / "Backend unreachable"
- **Cause:** Backend server is not running on port 8000 or CORS origin is blocked.
- **Solution:** Verify the backend is running at `http://localhost:8000/api/v1/health`. Ensure `CORS_ORIGINS` in `backend/.env` includes `http://localhost:5173`.

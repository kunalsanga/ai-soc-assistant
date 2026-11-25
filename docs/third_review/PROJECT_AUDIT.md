# Project Audit: AI-Powered Security Operations Center (SOC) Assistant Using LLMs

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review (Faculty Milestone Evaluation)  
**Audit Date:** 2026-11-09  
**Investigator:** Kunal Sanga (Reg. No: 2301341031)  
**Department:** Computer Science & Engineering, Silicon Institute of Technology, Sambalpur  
**Project Guide:** Miss Alka Dash (Assistant Professor, Department of CSE)  

---

## 1. Executive Summary

This comprehensive software and architectural audit investigates the current state of the **AI-Powered SOC Assistant** as implemented in the repository. The project aims to reduce SOC analyst alert fatigue, cross-reference telemetry against threat intelligence (MITRE ATT&CK Enterprise and NIST NVD CVEs), enforce strict evidence grounding, preserve corporate data privacy through local inference, and provide an interactive investigation dashboard.

### Core Verified Metrics as of Audit:
- **Backend Unit Tests:** 226 passed, 0 failed, 7 deprecation warnings (`pytest tests/unit` in 70.82s).
- **Frontend Unit Tests:** 32 passed, 0 failed across 8 test suites (`vitest run` in 9.09s).
- **Total Passing Unit Tests:** **258 automated tests**.
- **Production Build:** Vite v8.3.0 compiles with 0 TypeScript errors (`dist/assets/index-D_pzcHU_.js` 575.87 kB, CSS 90.11 kB).
- **Indexed Knowledge Chunks (Qdrant):** **1,762 chunks** verified (1,618 MITRE ATT&CK Enterprise chunks + 144 NIST NVD CVE chunks).
- **Curated Demonstration Telemetry:** 52 alerts across 10 tactical multi-stage attack scenarios in `app/data/demo/scenarios.py`.
- **Benchmark Completion:** Dataset v1 (8 cases, 24 evaluations) is 100% complete. Dataset v2 (40 cases, 120 evaluations planned) is **30.0% complete** (12 cases completed, 36 evaluations stored in `20261024-145621-1345d6`).

---

## 2. Recursive Project Structure Inventory

```
soc-assistant/
├── .env.wazuh.example          # Documentation template for live Wazuh Indexer integration
├── docker-compose.yml          # Container configuration (Postgres 15, Qdrant v1.18.2, Backend, Frontend)
├── README.md                   # Primary system overview documentation
├── backend/
│   ├── alembic/                # Database migrations
│   │   ├── env.py              # Async SQLAlchemy Alembic runner
│   │   └── versions/
│   │       ├── bdd08d1a3d55_initial_schema.py        # Alerts, Analyses, Evidence, Feedback tables
│   │       └── c01_add_datasource_provenance.py     # Adds data_source & ingestion_timestamp
│   ├── app/
│   │   ├── api/
│   │   │   ├── alerts/         # [DEAD CODE] Empty package placeholder (__init__.py)
│   │   │   ├── health/         # [DEAD CODE] Empty package placeholder (__init__.py)
│   │   │   ├── router.py       # Central APIRouter mounting all route blueprints
│   │   │   └── routes/         # Active route handlers
│   │   │       ├── alerts.py         # Alert CRUD, SSE streaming, graph, and trace endpoints (938 lines)
│   │   │       ├── analyses.py       # Read-only analysis and evidence retrieval
│   │   │       ├── dashboard.py      # Real-time SQL aggregation stats for metrics/charts
│   │   │       ├── datasources.py    # Multi-source summary (demo, live_wazuh, dataset_replay)
│   │   │       ├── evaluation.py     # Benchmark run inspect, latest run, dataset listing
│   │   │       ├── health.py         # Live bounded-timeout dependency checks
│   │   │       └── knowledge.py      # Qdrant semantic search & threat intelligence fast lookup
│   │   ├── core/
│   │   │   └── config.py       # Pydantic BaseSettings loading .env configuration
│   │   ├── data/
│   │   │   └── demo/
│   │   │       └── scenarios.py # 52 curated demonstration attack scenarios + provenance manifest
│   │   ├── datasources/
│   │   │   ├── manager.py      # Strict SQL filtering and isolation across data sources
│   │   │   └── schemas.py      # Pydantic schemas for data source statuses and summaries
│   │   ├── db/
│   │   │   ├── database.py     # SQLAlchemy AsyncEngine (asyncpg) & get_db dependency
│   │   │   └── models/
│   │   │       ├── __init__.py # Model exports
│   │   │       └── alert.py    # Alert, Analysis, Evidence, Feedback ORM classes
│   │   ├── evaluation/
│   │   │   └── metrics.py      # Precision, Recall, F1, MRR, Recall@k, Grounding rate calculations
│   │   ├── llm/
│   │   │   ├── client.py       # [DEAD CODE] Legacy PlaceholderLLMClient (unused)
│   │   │   ├── errors.py       # LLMProviderError definitions
│   │   │   ├── provider.py     # Abstract Base Class LLMProvider
│   │   │   ├── schemas.py      # LLMRequest, LLMResponse, SOCAnalysis, EvidenceReference Pydantic models
│   │   │   └── providers/
│   │   │       ├── mock.py     # MockLLMProvider for unit testing
│   │   │       └── ollama.py   # Ollama HTTP API provider (supports Qwen3 thinking toggle)
│   │   ├── rag/
│   │   │   ├── retriever.py    # Hybrid semantic + exact identifier retrieval & deduplication
│   │   │   ├── schemas.py      # Evidence, EvidenceSet data contracts
│   │   │   └── knowledge/
│   │   │       ├── chunking.py # Deterministic paragraph/word chunking (1200 char window, 150 overlap)
│   │   │       ├── normalize.py# Normalization of raw intelligence docs into KnowledgeDocument
│   │   │       ├── pipeline.py # Ingestion pipeline orchestrating sources, chunking, and Qdrant upsert
│   │   │       ├── schemas.py  # KnowledgeChunk, KnowledgeDocument dataclasses
│   │   │       ├── embeddings/
│   │   │       │   ├── base.py     # Abstract EmbeddingProvider
│   │   │       │   ├── hashing.py  # Deterministic hash embeddings (256-d, for testing/offline)
│   │   │       │   └── semantic.py # all-MiniLM-L6-v2 sentence-transformers (384-d dense vectors)
│   │   │       ├── sources/
│   │   │       │   ├── base.py     # BaseKnowledgeSource
│   │   │       │   ├── mitre.py    # MITRE ATT&CK STIX 2.1 JSON parser (enterprise-attack.json)
│   │   │       │   └── nvd.py      # NVD CVE 2.0 JSON parser (nvd-cves.json)
│   │   │       └── vectorstore/
│   │   │           └── qdrant.py   # Qdrant client wrapper, cosine distance, payload filtering
│   │   ├── schemas/
│   │   │   └── alert.py        # Pydantic schemas for API inputs and outputs
│   │   ├── security/
│   │   │   ├── context.py      # ContextExtractor (extracts IPs, users, rules, MITRE techniques)
│   │   │   ├── normalization.py# Wazuh alert and syslog raw dictionary normalizer
│   │   │   ├── pipeline.py     # Preprocessing -> Context Extraction -> Query Construction
│   │   │   ├── preprocessing.py# Sanitization, IP defanging, timestamp normalization
│   │   │   ├── retrieval_queries.py # RetrievalQueryBuilder (categorized query generation)
│   │   │   └── schemas.py      # SecurityContext, RetrievalQuerySet schemas
│   │   ├── services/
│   │   │   ├── analysis.py     # CRUD operations for Analysis and Evidence rows
│   │   │   ├── exceptions.py   # Service-level exception classes
│   │   │   ├── health.py       # Health checker inspecting Postgres, Qdrant, Ollama, Wazuh
│   │   │   └── orchestrator.py # SOCAnalysisOrchestrator: 3-mode analysis runner, SSE trace emitter
│   │   └── wazuh/
│   │       ├── client.py       # MockWazuhClient and RealWazuhClient (Manager API)
│   │       ├── exceptions.py   # WazuhError, WazuhConnectionError, WazuhAuthenticationError
│   │       ├── http.py         # Authenticated HTTP client with JWT token caching
│   │       ├── indexer.py      # WazuhIndexerClient (OpenSearch DSL POST /wazuh-alerts-*/_search)
│   │       ├── schemas.py      # NormalizedSecurityAlert, SyncResult schemas
│   │       └── service.py      # AlertService: fetches, normalizes, dedupes, and persists alerts
│   ├── evaluation/
│   │   ├── dataset_v1.json     # 8 baseline evaluation scenarios (v1)
│   │   ├── dataset_v2.json     # 40 curated evaluation scenarios (v2, 10 categories, 4 benign)
│   │   └── results/            # Historical benchmark runs (JSON, CSV, MD)
│   │       ├── 20261004-204202-74b318/
│   │       ├── 20261004-204343-4519ff/
│   │       ├── 20261017-040510-b9ebc8/  # Dataset v1 completed run (8 cases x 3 modes)
│   │       ├── 20261024-144522-b29f94/
│   │       ├── 20261024-145621-1345d6/  # Dataset v2 partial run (12 cases x 3 modes = 36 records)
│   │       └── latest.json              # Symlink/pointer to latest run
│   ├── knowledge/
│   │   ├── enterprise-attack.json       # 53.8 MB raw STIX 2.1 MITRE ATT&CK Enterprise bundle
│   │   └── nvd-cves.json                # 1.82 MB curated NVD CVE feed
│   ├── scripts/
│   │   ├── compare_embeddings.py        # Compares semantic vs hashing retrieval
│   │   ├── fetch_nvd.py                 # Fetches curated CVEs from NIST NVD API 2.0
│   │   ├── ingest.py                    # Ingests MITRE and NVD into Qdrant vector collection
│   │   ├── run_evaluation.py            # Headless research evaluation runner across 3 modes
│   │   ├── seed_demo_scenarios.py       # Seeds 52 demo alerts into PostgreSQL
│   │   ├── test_retrieval.py            # Smoke test for Qdrant retriever
│   │   └── verify_e2e.py                # Standalone end-to-end verification script
│   └── tests/
│       ├── conftest.py                  # Pytest fixtures and mock objects
│       ├── integration/
│       │   └── test_alerts_sync.py      # Integration test for Wazuh alert synchronization
│       └── unit/                        # 226 passing unit tests across 18 test files
├── frontend/
│   ├── package.json            # React 19, TypeScript ~6.0, TailwindCSS v4, Vitest v5
│   ├── vite.config.ts          # Vite build and proxy configuration
│   └── src/
│       ├── App.tsx             # Route definitions and navigation layout
│       ├── context/
│       │   └── DataSourceContext.tsx    # Global source switcher (Demo / Live Wazuh / Dataset Replay)
│       ├── components/
│       │   ├── common/         # Badges, metric cards, error states, skeletons
│       │   ├── investigation/  # ExecutionTrace waterfall, InvestigationGraph SVG, ThreatIntelDrawer
│       │   └── layout/         # Header, sidebar, source badge, breadcrumbs
│       ├── pages/
│       │   ├── Dashboard.tsx            # Alert stats, severity donut chart, connectivity strip
│       │   ├── Alerts.tsx               # Alert list, search, severity filters, sync button
│       │   ├── AlertDetails.tsx         # Alert inspection, raw telemetry JSON, trigger analysis
│       │   ├── AIAnalysis.tsx           # Tri-mode AI analysis viewer, findings, evidence citations
│       │   ├── EntityGraphPage.tsx      # Force-directed Obsidian-style interactive entity graph
│       │   ├── ExecutionTracesPage.tsx  # 10-stage execution waterfall and real-time SSE event log
│       │   ├── Evaluation.tsx           # Research benchmark viewer, P/R/F1 charts, ablation table
│       │   ├── SecurityKnowledge.tsx    # Qdrant knowledge base semantic explorer
│       │   └── Settings.tsx             # Configuration status, model parameters, API routes
│       └── services/
│           └── api.ts                   # Central Axios HTTP client and SSE event streaming
├── knowledge/                  # [DEAD DIRECTORY] Root empty directory (subdirs mitre, nvd, security_docs)
├── presentation/               # LaTeX Beamer slides, logos, and audit files
│   ├── project_facts.md        # Verified facts dossier for second review
│   ├── ppd2_second_review/     # PPD-II Second Review slides (main.tex, main.pdf)
│   └── Seminar_Presentation_1_/ # Seminar Presentation 1 slides and assets
└── scripts/                    # [DEAD DIRECTORY] Root empty directory
```

---

## 3. Module-by-Module Implementation Status

| Module / Component | Primary Files | Status | Connectivity / Reality Check |
|---|---|---|---|
| **FastAPI REST API** | [router.py](file:///backend/app/api/router.py), [main.py](file:///backend/app/main.py) | **Fully Working** | Exposes 21 endpoints; tested with unit and E2E scripts. |
| **PostgreSQL Database** | [database.py](file:///backend/app/db/database.py), [alert.py](file:///backend/app/db/models/alert.py) | **Partially Working** | Models defined; initial migration applied (`bdd08d1a3d55`), but migration `c01_datasource` is unapplied on host DB. |
| **Qdrant Vector DB** | [qdrant.py](file:///backend/app/rag/knowledge/vectorstore/qdrant.py) | **Fully Working** | Collection `security_knowledge` indexed with 1,762 vector points (384-d Cosine). |
| **Sentence Embeddings** | [semantic.py](file:///backend/app/rag/knowledge/embeddings/semantic.py) | **Fully Working** | `sentence-transformers/all-MiniLM-L6-v2` runs locally without external network dependencies. |
| **Ollama LLM Provider** | [ollama.py](file:///backend/app/llm/providers/ollama.py) | **Fully Working** | Interfaces with local `qwen3:8b` via `/api/chat`; temperature=0.0; supports `think=False` toggle. |
| **Security Context** | [context.py](file:///backend/app/security/context.py), [pipeline.py](file:///backend/app/security/pipeline.py) | **Fully Working** | Deterministic regex and token extraction; generates categorized query sets (`mitre`, `nvd`, `security`). |
| **Retriever & Anchoring** | [retriever.py](file:///backend/app/rag/retriever.py) | **Fully Working** | Multi-query execution; payload-filtered identifier search merged ahead of cosine similarity. |
| **Citation Validation** | [orchestrator.py](file:///backend/app/services/orchestrator.py) | **Partially Working** | Reference ID existence verified against retrieved set; semantic claim support (NLI) is **NOT** evaluated. |
| **Orchestrator** | [orchestrator.py](file:///backend/app/services/orchestrator.py) | **Fully Working** | Implements `llm_only`, `standard_rag`, and `evidence_aware`; emits SSE events for real-time waterfall. |
| **Data Source Isolation** | [manager.py](file:///backend/app/datasources/manager.py) | **Fully Working (Code)** | Isolates `demo`, `live_wazuh`, and `dataset_replay`; blocked on host DB due to unapplied migration. |
| **Wazuh Mock Client** | [client.py](file:///backend/app/wazuh/client.py) | **Fully Working** | Returns deterministic, realistic Wazuh alert shapes for offline development. |
| **Wazuh Real Client** | [client.py](file:///backend/app/wazuh/client.py), [http.py](file:///backend/app/wazuh/http.py) | **Implemented, Untested** | Implements JWT authentication against Wazuh Manager port 55000; pending live SIEM cluster. |
| **Wazuh Indexer Client** | [indexer.py](file:///backend/app/wazuh/indexer.py) | **Implemented, Untested** | OpenSearch DSL client (`POST /wazuh-alerts-*/_search`) over TLS; pending live OpenSearch cluster. |
| **Evaluation Runner** | [run_evaluation.py](file:///backend/scripts/run_evaluation.py) | **Partially Working** | Functional runner; suffers from alert ID collision bug between v1 and v2 in database. |
| **React Frontend** | [frontend/src/](file:///frontend/src/) | **Fully Working** | 10 comprehensive pages; responsive SVG entity graph; interactive waterfall; 32 passing tests. |

---

## 4. Unused Files, Dead Code, and Duplicates

### 4.1 Unused Files and Dead Code
1. **`backend/app/llm/client.py`:**
   - Defines `BaseLLMClient` and `PlaceholderLLMClient` returning `"AI analysis pipeline not connected yet."`.
   - Completely orphaned; never imported anywhere in `backend/app/` or `backend/tests/`. The active interface is `app/llm/provider.py`.
2. **`backend/app/api/alerts/__init__.py` & `backend/app/api/health/__init__.py`:**
   - Leftover stub packages from an early refactoring where routes were intended to live in separate sub-packages. All active route handlers reside directly in `backend/app/api/routes/`.
3. **Root `scripts/` directory:**
   - Empty folder at the project root. All operational scripts reside in `backend/scripts/`.
4. **Root `knowledge/` directory:**
   - Contains empty folders `knowledge/mitre/`, `knowledge/nvd/`, `knowledge/security_docs/`. The real knowledge data resides in `backend/knowledge/` (`enterprise-attack.json` and `nvd-cves.json`).

### 4.2 Duplicate Route Implementations
In `backend/app/api/routes/alerts.py`:
- Lines 86–91 define `@router.get("/demo-manifest")`
- Lines 325–330 define `@router.get("/demo-manifest")` **again with identical implementation**
- Lines 93–98 define `@router.post("/seed-demo")`
- Lines 332–337 define `@router.post("/seed-demo")` **again with identical implementation**
- *Impact:* Harmless to FastAPI (first registered route wins), but reflects sloppy code duplication that must be cleaned up.

### 4.3 Documentation Discrepancies
- In `docs/ARCHITECTURE.md` (lines 89–90), documentation references `app/llm/parsers.py` and `app/services/evidence_validator.py`. Neither file exists on disk; both routines are implemented internally within `backend/app/services/orchestrator.py` (`_parse_llm_response` and `_validate_evidence`).

---

## 5. Potential Architectural Inconsistencies & Gaps

1. **Host Database Schema Divergence:**
   - Host PostgreSQL (`localhost:5432/soc_assistant`) is at revision `bdd08d1a3d55`.
   - Migration `c01_datasource` has not been applied to the local host DB, causing `ProgrammingError: column alerts.data_source does not exist` whenever `DataSourceManager.filter_query` is executed on the host.
2. **Execution Trace State Persistence Gap:**
   - Live execution emits actual per-stage millisecond latencies via SSE.
   - However, the `Analysis` database table only persists `summary`, `severity_assessment`, `explanation`, `recommended_investigation`, `confidence`, `model_name`, and `analysis_type`.
   - Consequently, when `GET /alerts/{alert_id}/trace` is called on historical analyses, stage timings are **synthesized with default constants** (`duration_ms: 4200`, `35`, `14`) rather than retrieved from recorded database telemetry.
3. **Database Alert ID Collision in Benchmark Execution:**
   - In `backend/scripts/run_evaluation.py` (`seed_alert`):
     ```python
     existing = (await db.execute(select(Alert).where(Alert.external_alert_id == external_id))).scalar_one_or_none()
     if existing is not None:
         return existing.id
     ```
   - When transitioning from Dataset v1 (where `eval-003` was a Web Shell alert) to Dataset v2 (where `eval-003` was redefined as Kerberoasting), the script re-used the stale v1 database row.
   - This caused the LLM to analyze the old alert while the evaluation script scored it against the new ground truth, artificially creating 0.0 precision/recall scores for cases 3 through 8.


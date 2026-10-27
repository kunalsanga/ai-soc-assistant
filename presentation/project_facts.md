# Verified Project Audit & Evidence Dossier

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review:** PPD-II Second Review (Session 2026–2027)  
**Investigator:** Kunal Sanga (Registration No: `2301341031`)  
**Department:** Computer Science and Engineering, Silicon Institute of Technology, Sambalpur  
**Project Supervisor:** Miss Alka Dash (Assistant Professor, Department of CSE)  
**Audit Timestamp:** 2026-10-26 13:20 IST  

---

## 1. Project Objectives & Problem Definition

### Operational Problem
- **Alert Fatigue & Inundation**: SOC analysts face hundreds of raw telemetry events per shift from diverse sensors (EDR, IDS, Syslog), leading to analyst burnout and missed critical breaches.
- **Cognitive Overhead in Threat Attribution**: Manual cross-referencing of observed Indicators of Compromise (IoCs) against threat frameworks (MITRE ATT&CK enterprise matrices, NIST NVD CVE feeds) creates significant Mean Time to Detect (MTTD) delays.
- **Hallucination Risks in Generic LLMs**: Off-the-shelf generative AI models hallucinate non-existent CVEs and cite phantom threat actor techniques when reasoning on raw security alerts without grounded evidence.
- **Data Confidentiality & Sovereign Isolation**: Cloud-based LLMs (e.g. OpenAI GPT-4) expose internal corporate telemetry, hostnames, and IP addresses to third-party cloud infrastructure.

### Research Objectives
1. **Evidence-Grounded RAG Advisory**: Develop a specialized, on-premise advisory pipeline citing verified security knowledge (MITRE ATT&CK v14 and NIST NVD).
2. **Local, Private Deployment**: Maintain strict enterprise telemetry privacy by deploying local LLM inference (Ollama running `qwen3:8b`, temperature 0.0) and on-premise vector storage (Qdrant).
3. **Rigorous Decision Provenance**: Implement automated citation validation where every claim references retrieved evidence IDs before persistence.
4. **Isolated Multi-Source Telemetry Architecture**: Provide clean separation across synthetic demo scenarios, live Wazuh server telemetry, and historical dataset replay without data blending or counter inflation.
5. **Human-in-the-Loop Operational Interface**: Deliver an Obsidian-style force-directed Entity Graph, execution waterfall traces, and alert triage dashboard for SOC analysts.

---

## 2. System Architecture & Component Verification

```
+-----------------------------------------------------------------------------------+
|                            REACT 19 + TYPESCRIPT UI                               |
|  - Dashboard (KPIs, Donut Chart)       - Alert Management Console                 |
|  - Obsidian Entity Graph               - Pipeline Execution Traces (Waterfall)    |
|  - Data Source Selector (Demo / Live Wazuh / Dataset Replay)                      |
+----------------------------------------+------------------------------------------+
                                         | REST API (HTTP / JSON / SSE)
+----------------------------------------v------------------------------------------+
|                               FASTAPI BACKEND                                     |
|  - /alerts, /dashboard/stats, /datasources, /health, /analyses, /evaluation       |
|  - Security Context Pipeline: Rule parsing, entity extraction, query synthesis    |
|  - DataSourceManager: Strict SQL-level source filtering                          |
+-------------------+--------------------+-------------------+----------------------+
                    |                    |                   |
                    v                    v                   v
+-------------------+---+  +-------------+------+  +---------+------------+
|  POSTGRESQL 15+ (DB)  |  |   QDRANT VECTOR DB   |  |     OLLAMA LLM       |
|  - Alerts Table (95)  |  | Collection:          |  | Local `qwen3:8b`     |
|  - Analyses (44 recs) |  |   security_knowledge |  | Temp: 0.0, Det.      |
|  - Evidence (48 recs) |  | Points: 1,762 chunks |  | Execution Latency:   |
|  - Alembic Migrations |  | 384-d Cosine HNSW    |  | 35-80 s (hardware)   |
+-----------------------+  +--------------------+  +----------------------+
```

### Subsystem Verification Status
| Subsystem | Implemented In Code | Verified Via Safe Testing | Verification Evidence / Command |
|---|---|---|---|
| **FastAPI REST API** | Yes (`backend/app/api/`) | Yes | 226 passed backend tests; live `GET /health` returns `dependencies_ok: true` |
| **PostgreSQL 15+** | Yes (`backend/app/db/`) | Yes | Alembic migrations (`bdd08d1a3d55`, `c01_datasource`) applied; 95 alerts, 44 analyses |
| **Qdrant Vector DB** | Yes (`backend/app/knowledge/`) | Yes | Collection `security_knowledge` verified active with **1,762 vector points** |
| **Dense Semantic Embeddings**| Yes (`backend/app/knowledge/`) | Yes | Local `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors) |
| **Ollama LLM Provider** | Yes (`backend/app/llm/`) | Yes | Model `qwen3:8b` verified reachable at local Ollama host, temp=0.0 |
| **Data Source Abstraction** | Yes (`backend/app/datasources/`) | Yes | Tested with 5 isolated unit tests in `test_data_sources.py` |
| **Wazuh Indexer Client** | Yes (`backend/app/wazuh/indexer.py`) | Yes (Transport & Mock) | Read-only OpenSearch DSL (`POST /wazuh-alerts-*/_search`) client implemented; auth guards verified |
| **Wazuh Manager Client** | Yes (`backend/app/wazuh/client.py`) | Yes (Transport & Mock) | JWT authentication client implemented; live cluster pending remote deployment |
| **React 19 Frontend** | Yes (`frontend/src/`) | Yes | 32 passed Vitest unit tests across 8 test suites; production bundle built cleanly in 4.91s |

---

## 3. Real Database & Knowledge Base Telemetry Statistics

*Verified directly from live running containers on 2026-10-26 13:16 IST:*

- **Alerts in Database**: 95 total records
  - `demo`: 95 alerts (52 curated demonstration attack scenarios + 40 evaluation cases + 3 initial mock records)
  - `live_wazuh`: 0 alerts (strictly isolated; zero counter, no synthetic blending)
  - `dataset_replay`: 0 alerts
- **Severity Distribution (Demo Source)**:
  - Critical (level $\ge$ 12): 25 alerts
  - High (level 8--11): 52 alerts
  - Medium (level 5--7): 12 alerts
  - Low (level 2--4): 6 alerts
  - Info (level < 2): 0 alerts
- **Persisted Analyses**: 44 total records
  - Evidence-Aware Mode: 18 analyses
  - Standard RAG Mode: 13 analyses
  - LLM-Only Mode: 13 analyses
- **Persisted Evidence Citations**: 48 foreign-key linked records
- **Knowledge Base Vector Chunks (Qdrant)**:
  - Total Points: **1,762 chunks**
  - MITRE ATT&CK Enterprise Techniques (v14): 1,618 chunks
  - NIST NVD CVE Intelligence Records: 144 chunks

---

## 4. Software Quality & Automated Test Outcomes

*Verified via live execution in Docker and local Node environments:*

### Backend Unit Tests (Pytest v9.1.1, Python 3.11/3.13)
- **Command**: `PYTHONPATH=. pytest tests/unit`
- **Result**: **226 passed, 0 failed, 7 warnings** in 44.51s
- **Verified Areas**:
  - `test_alert_service.py` (5 tests): Alert normalization, deduplication, raw data persistence
  - `test_analysis_routes.py` (12 tests): Multi-mode execution routes and error handling
  - `test_analysis_service.py` (22 tests): Analysis lifecycle and prompt assembly
  - `test_data_sources.py` (5 tests): Source normalization, isolation, Wazuh Indexer client error handling
  - `test_evaluation_metrics.py` (22 tests): MITRE technique P/R/F1, CVE P/R/F1, MRR, citation rates
  - `test_evaluation_resume.py` (11 tests): Checkpointing and resume functionality
  - `test_graph_and_trace.py` (3 tests): Entity graph nodes and execution trace stages
  - `test_health.py` (1 test): System health diagnostics
  - `test_knowledge_*.py` (53 tests): Chunking, embeddings, pipeline, vector store
  - `test_normalization.py` (9 tests): Syslog, Wazuh alert JSON normalization
  - `test_ollama_provider.py` & `test_llm.py` (13 tests): Ollama client, schema extraction
  - `test_orchestrator.py` (5 tests): 3 analysis modes
  - `test_real_wazuh_client.py` & `test_wazuh.py` (15 tests): Wazuh transport and client factory
  - `test_security_context.py` & `test_retriever.py` (28 tests): IoC extraction, query builder, retrieval ranking
  - `test_semantic_embeddings.py` (13 tests): MiniLM embeddings and cosine similarity

### Frontend Unit Tests (Vitest v5.0.1, React 19)
- **Command**: `npm test -- --run`
- **Result**: **32 passed, 0 failed** across 8 test suites in 27.01s
- **Verified Suites**:
  - `Evaluation.test.tsx` (3 tests)
  - `AIAnalysis.test.tsx` (4 tests)
  - `ExecutionTracesPage.test.tsx` (6 tests)
  - `Layout.test.tsx` (4 tests)
  - `Dashboard.test.tsx` (4 tests)
  - `Alerts.test.tsx` (4 tests)
  - `EntityGraphPage.test.tsx` (4 tests)
  - `App.test.tsx` (3 tests)

### Frontend Production Build
- **Command**: `npm run build`
- **Result**: **Success in 4.91s** (0 TypeScript errors, bundle compiled to `dist/`)

---

## 5. Preliminary Results & Experimental Benchmark Status

### Controlled Tri-Mode Evaluation Protocol
To scientifically evaluate RAG contributions, the system compares three controlled modes:
1. `llm_only`: Raw prompt with alert details passed to `qwen3:8b` without external retrieval.
2. `standard_rag`: Unanchored semantic retrieval over alert rule description.
3. `evidence_aware`: Multi-query synthesis, entity anchoring, dense vector retrieval, and automated citation validation.

### Dataset v2 Benchmark Run Status (`20261024-145621-1345d6`)
- **Planned Scope**: 40 curated synthetic scenarios $\times$ 3 modes = 120 evaluations.
- **Current Execution Status**: **12 scenarios completed (36 evaluations completed)**. 84 evaluations pending execution.
- **Empirical Measurements (12 Scenarios, 36 Evaluations)**:
  - **LLM-Only (Baseline)**:
    - Wall Latency: 36.8 s (LLM Generation Latency: 36.7 s)
    - MITRE Technique Precision: 0.500
    - MITRE Technique Recall: 0.417
    - MITRE Technique F1: 0.444
    - Valid Citation Rate: N/A (no external citations provided)
  - **Standard RAG**:
    - Wall Latency: 82.2 s (LLM Generation Latency: 79.0 s)
    - MITRE Technique Precision: 0.500
    - MITRE Technique Recall: 0.417
    - MITRE Technique F1: 0.444
    - Valid Citation Rate: **1.000 (100% of cited evidence IDs exist in retrieved set)**
  - **Evidence-Aware RAG**:
    - Wall Latency: 79.6 s (LLM Generation Latency: 79.4 s)
    - MITRE Technique Precision: 0.500
    - MITRE Technique Recall: 0.417
    - MITRE Technique F1: 0.444
    - Valid Citation Rate: **1.000 (100% of cited evidence IDs exist in retrieved set)**

### Dataset v1 Completed Benchmark ($N=8$, Completed Run `20261017-040510-b9ebc8`)
- **Retrieval Recall@1**:
  - Evidence-Aware RAG: **1.000 (100%)**
  - Standard RAG: **0.250 (25%)**
  - LLM-Only: 0.000
- **Retrieval Mean Reciprocal Rank (MRR)**:
  - Evidence-Aware RAG: **1.000**
  - Standard RAG: **0.354**
- **Technique F1**: 0.833 across 8 baseline scenarios.

### Retrieval-Only Ablation Study (No LLM in Loop)
- **Semantic Anchored (Entity Anchoring)**:
  - Recall@1: **1.000**
  - MRR: **1.000**
  - Search Latency: 1563 ms
- **Semantic Unanchored (Basic String Search)**:
  - Recall@1: **0.375**
  - MRR: **0.463**
  - Search Latency: 338 ms
- **Scientific Conclusion**: Entity anchoring on security indicators dramatically boosts top-1 retrieval precision, ensuring the LLM is fed the exact relevant MITRE technique chunk.

---

## 6. Wazuh Integration Status & Transparency Disclosures

1. **Wazuh Connector Implementation**:
   - Both **Wazuh Indexer** (OpenSearch DSL `POST /wazuh-alerts-*/_search`, HTTP Basic Auth, TLS verification) and **Wazuh Manager** (REST API `GET /alerts`, JWT token refresh) clients are fully implemented in Python.
2. **Current Operational Mode**:
   - The system is currently running in `WAZUH_MODE=mock` with development mock telemetry.
   - The laptop environment (16 GB RAM, ~0.5 GB free) cannot safely host a local Wazuh Indexer + Manager cluster.
   - Live ingestion is ready and will be connected to a remote Wazuh server using `.env.wazuh.example`.
3. **Data Source Separation**:
   - The UI includes an explicit source selector: **Demo Data**, **Live Wazuh**, **Dataset Replay**.
   - In Live Wazuh mode, 0 live alerts are currently reported. Synthetic demo records are never blended into live telemetry views.

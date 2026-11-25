# End-to-End System Execution Flow & Architecture

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review  
**Audit Date:** 2026-11-09  

---

## 1. System Architecture Diagram (Real Implementation)

The following Mermaid diagram depicts the true end-to-end data flow as implemented in the codebase:

```mermaid
flowchart TD
    subgraph Telemetry["1. Telemetry Ingestion Tier"]
        WazuhMock["MockWazuhClient\n(Deterministic Attack Scenarios)"]
        WazuhReal["RealWazuhClient / WazuhIndexerClient\n(OpenSearch DSL / JWT Auth - Pending Lab)"]
        AlertService["AlertService.sync_alerts()\n(backend/app/wazuh/service.py)"]
        Normalizer["normalize_wazuh_alert()\n(backend/app/security/normalization.py)"]
    end

    subgraph RelationalDB["2. Storage & Provenance Tier"]
        Postgres[(PostgreSQL 15+\nTables: alerts, analyses, evidence)]
        DSManager["DataSourceManager\n(backend/app/datasources/manager.py)"]
    end

    subgraph SecurityContextTier["3. Context & Query Formulation Tier"]
        ContextExt["ContextExtractor.extract()\n(backend/app/security/context.py)"]
        QueryBuilder["RetrievalQueryBuilder.build()\n(backend/app/security/retrieval_queries.py)"]
    end

    subgraph KnowledgeRetrieval["4. Knowledge Retrieval & Vector Tier"]
        MiniLM["SemanticEmbeddingProvider\n(all-MiniLM-L6-v2, 384-dim)"]
        QdrantDB[(Qdrant Vector DB\nCollection: security_knowledge\n1,762 Points: 1,618 MITRE + 144 NVD)]
        Retriever["Retriever.retrieve_query_set()\n(Hybrid Semantic + Exact ID Anchoring)"]
    end

    subgraph ReasoningEngine["5. LLM Inference & Validation Tier"]
        Orchestrator["SOCAnalysisOrchestrator.analyze_alert()\n(backend/app/services/orchestrator.py)"]
        PromptBuilder["Orchestrator._build_prompts()\n(Strict JSON Schema Contract)"]
        Ollama["OllamaLLMProvider.generate()\n(Local Qwen3:8B, Temp: 0.0)"]
        CitationVal["Orchestrator._validate_evidence()\n(Evidence ID Grounding Check)"]
        AnalysisService["AnalysisService.create_analysis()\n(backend/app/services/analysis.py)"]
    end

    subgraph FrontendTier["6. SOC Analyst Workspace Tier"]
        FastAPI["FastAPI REST API & SSE Streaming\n(backend/app/api/routes/alerts.py)"]
        UI_Dash["React Dashboard\n(/dashboard)"]
        UI_Alerts["Alerts Console\n(/alerts)"]
        UI_Analysis["Tri-Mode Analysis\n(/analysis/:id)"]
        UI_Graph["Obsidian Entity Graph\n(/graph/:id)"]
        UI_Trace["Pipeline Execution Trace\n(/execution/:id)"]
    end

    WazuhMock --> AlertService
    WazuhReal -.-> AlertService
    AlertService --> Normalizer
    Normalizer -->|Idempotent Insert| Postgres
    Postgres --> DSManager
    DSManager --> FastAPI

    FastAPI -->|Trigger Analysis| Orchestrator
    Orchestrator --> ContextExt
    ContextExt --> QueryBuilder
    QueryBuilder -->|RetrievalQuerySet| Retriever
    Retriever --> MiniLM
    MiniLM --> QdrantDB
    Retriever -->|Payload Filter (Exact ID)| QdrantDB
    QdrantDB -->|Candidate Chunks| Retriever
    Retriever -->|Ranked EvidenceSet| Orchestrator

    Orchestrator --> PromptBuilder
    PromptBuilder -->|LLMRequest| Ollama
    Ollama -->|JSON Output| CitationVal
    CitationVal -->|Validated SOCAnalysis| AnalysisService
    AnalysisService -->|Persist Analysis & Evidence| Postgres

    Orchestrator -.->|SSE Trace Events| FastAPI
    FastAPI --> UI_Dash
    FastAPI --> UI_Alerts
    FastAPI --> UI_Analysis
    FastAPI --> UI_Graph
    FastAPI --> UI_Trace
```

---

## 2. Granular Stage-by-Stage Execution Breakdown

### Stage 1: Security Alert Generation & Telemetry Ingestion
- **Implementing File:** [`backend/app/wazuh/client.py`](file:///backend/app/wazuh/client.py), [`backend/app/wazuh/service.py`](file:///backend/app/wazuh/service.py), [`backend/app/wazuh/indexer.py`](file:///backend/app/wazuh/indexer.py)
- **Responsible Class/Function:** `MockWazuhClient.get_alerts()`, `WazuhIndexerClient.get_alerts()`, `AlertService.sync_alerts()`
- **Input:** External SIEM telemetry stream or deterministic scenario mock payload.
- **Output:** Raw dictionary matching Wazuh v4.x alert schema (`rule`, `agent`, `data`, `location`).
- **Dependencies:** `httpx` (for real/indexer clients), `asyncio`.
- **Status:** **Fully Working** for Mock client; **Implemented but Untested** for real Wazuh manager/indexer.
- **Application Connection:** Connected to `POST /api/v1/alerts/sync` and `POST /api/v1/alerts/sync-mock`.

### Stage 2: Alert Normalization & Invariant Enforcement
- **Implementing File:** [`backend/app/security/normalization.py`](file:///backend/app/security/normalization.py)
- **Responsible Function:** `normalize_wazuh_alert(raw: dict) -> NormalizedSecurityAlert`
- **Input:** Raw unparsed Wazuh JSON/dict.
- **Output:** Pydantic `NormalizedSecurityAlert` with standard keys (`external_alert_id`, `timestamp`, `severity`, `rule_id`, `rule_description`, `agent_name`, `source_ip`, `destination_ip`, `username`).
- **Dependencies:** `pydantic`.
- **Status:** **Fully Working** (validated with 9 dedicated unit tests in `test_normalization.py`).
- **Application Connection:** Called inside `AlertService.sync_alerts()`, `run_evaluation.py`, and `seed_demo_scenarios.py`.

### Stage 3: Operational Persistence & Data Source Isolation
- **Implementing File:** [`backend/app/wazuh/service.py`](file:///backend/app/wazuh/service.py), [`backend/app/datasources/manager.py`](file:///backend/app/datasources/manager.py)
- **Responsible Class/Function:** `AlertService.sync_alerts()`, `DataSourceManager.filter_query()`
- **Input:** `NormalizedSecurityAlert`, target `data_source` tag (`demo`, `live_wazuh`, `dataset_replay`).
- **Output:** Persisted row in `alerts` table; assigned integer primary key (`Alert.id`).
- **Dependencies:** SQLAlchemy `AsyncSession`, PostgreSQL.
- **Status:** **Partially Working** (Database models and query logic fully implemented; fails on host PostgreSQL because Alembic migration `c01_datasource` is not applied).
- **Application Connection:** Connected to all read endpoints via `get_alerts()` and `dashboard_stats()`.

### Stage 4: Security Context & Indicator Extraction
- **Implementing File:** [`backend/app/security/context.py`](file:///backend/app/security/context.py), [`backend/app/security/preprocessing.py`](file:///backend/app/security/preprocessing.py)
- **Responsible Class/Function:** `preprocess_alert()`, `ContextExtractor.extract()`
- **Input:** `PreprocessedAlert` derived from normalized alert.
- **Output:** `SecurityContext` containing extracted IP addresses, ports, usernames, host OS, keywords, attack terms, and MITRE technique IDs.
- **Dependencies:** Pure standard library regex and token matching.
- **Status:** **Fully Working** (0 external network calls, completely deterministic).
- **Application Connection:** Connected to `GET /api/v1/alerts/{id}/security-context` and invoked in Step 2 of `SOCAnalysisOrchestrator`.

### Stage 5: Structured Retrieval Query Synthesis
- **Implementing File:** [`backend/app/security/retrieval_queries.py`](file:///backend/app/security/retrieval_queries.py)
- **Responsible Class/Function:** `RetrievalQueryBuilder.build()`
- **Input:** `SecurityContext` instance.
- **Output:** `RetrievalQuerySet` containing:
  - `mitre_queries`: Technique-targeted queries (e.g. `"MITRE ATT&CK technique T1110"`)
  - `nvd_queries`: CVE-targeted queries (e.g. `"CVE-2021-44228 vulnerability details"`)
  - `security_queries`: General attack description queries (e.g. `"sshd attempt login non-existent user"`)
- **Dependencies:** `app.security.schemas`.
- **Status:** **Fully Working**.
- **Application Connection:** Connected directly to `Retriever.retrieve_query_set()`.

### Stage 6: Knowledge Base Retrieval & Entity Anchoring
- **Implementing File:** [`backend/app/rag/retriever.py`](file:///backend/app/rag/retriever.py), [`backend/app/rag/knowledge/vectorstore/qdrant.py`](file:///backend/app/rag/knowledge/vectorstore/qdrant.py)
- **Responsible Class/Function:** `Retriever.retrieve_query_set()`, `QdrantIndex.search()`
- **Input:** `RetrievalQuerySet`, `top_k=5`, `score_threshold=0.0`.
- **Output:** `EvidenceSet` of top-$k$ ranked `Evidence` chunks with provenance URLs and similarity scores.
- **Mechanism:**
  - Standard pass: Embeds query text with `all-MiniLM-L6-v2` (384-d dense vector) and performs Qdrant cosine search.
  - Identifier-anchored pass: For queries containing `T1xxx` or `CVE-xxxx`, executes an exact payload-filtered search (`source_identifier == T1xxx`).
  - Merge & Rank: Deduplicates on `chunk_id`. Anchored hits are placed ahead of general semantic hits.
- **Status:** **Fully Working** (1,762 indexed chunks in Qdrant).
- **Application Connection:** Connected in Step 5 of `SOCAnalysisOrchestrator`.

### Stage 7: Evidence Grounding & Prompt Formulation
- **Implementing File:** [`backend/app/services/orchestrator.py`](file:///backend/app/services/orchestrator.py)
- **Responsible Class/Function:** `SOCAnalysisOrchestrator._build_prompts()`
- **Input:** `NormalizedSecurityAlert` and `EvidenceSet`.
- **Output:** System prompt with strict JSON schema instructions + user prompt containing alert JSON and numbered retrieved evidence chunks.
- **Dependencies:** `app.llm.schemas.LLMRequest`.
- **Status:** **Fully Working**.
- **Application Connection:** Connected in Step 7 of `SOCAnalysisOrchestrator`.

### Stage 8: Local Privacy-Preserving LLM Inference
- **Implementing File:** [`backend/app/llm/providers/ollama.py`](file:///backend/app/llm/providers/ollama.py)
- **Responsible Class/Function:** `OllamaLLMProvider.generate()`
- **Input:** `LLMRequest` (temperature=0.0, max_tokens=1000, model=`qwen3:8b`).
- **Output:** `LLMResponse` containing raw JSON string, latency metrics, and token usage counts.
- **Dependencies:** Local Ollama daemon running on `http://localhost:11434` or `http://host.docker.internal:11434`.
- **Status:** **Fully Working** (Ollama client verified; execution latency 35–80s on CPU).
- **Application Connection:** Connected in Step 8 of `SOCAnalysisOrchestrator`.

### Stage 9: Output Parsing & Citation Validation
- **Implementing File:** [`backend/app/services/orchestrator.py`](file:///backend/app/services/orchestrator.py)
- **Responsible Functions:** `SOCAnalysisOrchestrator._parse_llm_response()`, `SOCAnalysisOrchestrator._validate_evidence()`
- **Input:** Raw LLM string output and `EvidenceSet`.
- **Output:** Validated `SOCAnalysis` object and list of `EvidenceCreate` models.
- **Validation Logic:** Checks whether `evidence_reference.evidence_id` exists in the retrieved set. Hallucinated IDs are stripped and flagged in `limitations`.
- **Status:** **Partially Working** (Reference ID validation works; semantic claim entailment/NLI check is missing).
- **Application Connection:** Connected in Step 9 of `SOCAnalysisOrchestrator`.

### Stage 10: State Persistence & Relational Provenance
- **Implementing File:** [`backend/app/services/analysis.py`](file:///backend/app/services/analysis.py)
- **Responsible Class/Function:** `AnalysisService.create_analysis()`
- **Input:** Database session, `alert_id`, `AnalysisCreate` payload with linked `EvidenceCreate` objects.
- **Output:** Persisted `analyses` record and foreign-key linked `evidence` records.
- **Dependencies:** SQLAlchemy `AsyncSession`.
- **Status:** **Fully Working**.
- **Application Connection:** Connected in Step 10 of `SOCAnalysisOrchestrator`.

### Stage 11: Real-Time Analyst Streaming & Visualization
- **Implementing File:** [`backend/app/api/routes/alerts.py`](file:///backend/app/api/routes/alerts.py), [`frontend/src/services/api.ts`](file:///frontend/src/services/api.ts)
- **Responsible Endpoints:**
  - `POST /api/v1/alerts/{alert_id}/analyze`: Synchronous analysis trigger.
  - `GET /api/v1/alerts/{alert_id}/analyze/stream`: Server-Sent Events (SSE) streaming live stage-by-stage events (`trace_event`).
  - `GET /api/v1/alerts/{alert_id}/graph`: Obsidian-style entity relationship graph.
  - `GET /api/v1/alerts/{alert_id}/trace`: Pipeline execution waterfall.
- **Status:** **Fully Working**.
- **Application Connection:** Connected to frontend `AIAnalysis.tsx`, `EntityGraphPage.tsx`, and `ExecutionTracesPage.tsx`.


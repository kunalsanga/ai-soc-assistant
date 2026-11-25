# Testing and Software Quality Audit

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review  
**Audit Date:** 2026-11-09  

---

## 1. Test Execution Summary

| Test Layer | Framework | Total Tests | Passed | Failed | Skipped | Warnings | Execution Time |
|---|---|---|---|---|---|---|---|
| **Backend Unit Tests** | Pytest 9.1.1 + pytest-asyncio | 226 | **226** | 0 | 0 | 7 | 70.82 s |
| **Frontend Unit Tests** | Vitest 5.0.1 + React Testing Lib | 32 | **32** | 0 | 0 | 0 | 9.09 s |
| **Combined Automated Tests** | — | **258** | **258** | **0** | **0** | **7** | **79.91 s** |
| **Frontend TypeScript Build** | `tsc -b && vite build` | 1,964 modules | **Success** | 0 errors | — | 1 size warning | 1.12 s |

---

## 2. Backend Test Suite Breakdown (`backend/tests/unit/`)

| Test File | Test Count | Focus Area & Verified Behaviors | Mock Usage vs Real Logic |
|---|---|---|---|
| [`test_alert_service.py`](file:///backend/tests/unit/test_alert_service.py) | 5 | Ingestion idempotency, deduplication, raw data persistence, error handling | Uses `MockWazuhClient`; mocks DB session |
| [`test_analysis_routes.py`](file:///backend/tests/unit/test_analysis_routes.py) | 12 | HTTP endpoints `/alerts/{id}/analyze`, `/analysis`, route precedence, query params | Mocks orchestrator and DB session |
| [`test_analysis_service.py`](file:///backend/tests/unit/test_analysis_service.py) | 22 | CRUD operations for Analysis and Evidence tables, relationship integrity | Mocks SQLAlchemy `AsyncSession` |
| [`test_data_sources.py`](file:///backend/tests/unit/test_data_sources.py) | 5 | Source normalization (`demo`, `live_wazuh`), query filtering, SQL isolation | Mocks database and client factory |
| [`test_evaluation_metrics.py`](file:///backend/tests/unit/test_evaluation_metrics.py) | 22 | MITRE technique P/R/F1, CVE P/R/F1, MRR, Recall@k, citation validity, negative controls | **100% Real Logic** (Pure mathematical functions) |
| [`test_evaluation_resume.py`](file:///backend/tests/unit/test_evaluation_resume.py) | 11 | Benchmark checkpointing, JSON/CSV resume logic, partial run handling | **Real filesystem operations** (uses `tmp_path`) |
| [`test_graph_and_trace.py`](file:///backend/tests/unit/test_graph_and_trace.py) | 3 | Obsidian entity graph node/edge creation, 10-stage execution trace structure | Mocks database query scalar returns |
| [`test_health.py`](file:///backend/tests/unit/test_health.py) | 1 | Dependency checks, service statuses, health diagnostics | Mocks external service sockets |
| [`test_knowledge_chunking.py`](file:///backend/tests/unit/test_knowledge_chunking.py) | 12 | Paragraph splitting, chunk size/overlap boundary adherence, deterministic IDs | **100% Real Logic** |
| [`test_knowledge_embeddings.py`](file:///backend/tests/unit/test_knowledge_embeddings.py) | 14 | Local hashing provider, dimension sizing, vector normalization | **100% Real Logic** |
| [`test_knowledge_pipeline.py`](file:///backend/tests/unit/test_knowledge_pipeline.py) | 9 | End-to-end ingestion pipeline from sources to vector store | Mocks Qdrant client connection |
| [`test_knowledge_schemas.py`](file:///backend/tests/unit/test_knowledge_schemas.py) | 7 | Invariants for `KnowledgeChunk`, `KnowledgeDocument`, provenance URLs | **100% Real Logic** |
| [`test_knowledge_sources.py`](file:///backend/tests/unit/test_knowledge_sources.py) | 6 | MITRE STIX JSON and NVD CVE JSON parsing and error recovery | **Real JSON loading** (uses minimal fixtures) |
| [`test_knowledge_vectorstore.py`](file:///backend/tests/unit/test_knowledge_vectorstore.py) | 5 | Qdrant vector index payload filters, collection recreation, UUID generation | Mocks Qdrant client methods |
| [`test_llm.py`](file:///backend/tests/unit/test_llm.py) | 8 | Pydantic schema validation for `LLMRequest`, `SOCAnalysis`, `EvidenceReference` | **100% Real Logic** |
| [`test_normalization.py`](file:///backend/tests/unit/test_normalization.py) | 9 | Wazuh JSON and syslog alert normalization, IP parsing, field fallbacks | **100% Real Logic** |
| [`test_ollama_provider.py`](file:///backend/tests/unit/test_ollama_provider.py) | 5 | Ollama HTTP client payload construction, think parameter, timeout error translation | Mocks `httpx.Client.post` |
| [`test_orchestrator.py`](file:///backend/tests/unit/test_orchestrator.py) | 5 | Tri-mode pipeline coordination (`llm_only`, `standard_rag`, `evidence_aware`) | Mocks LLM provider and retriever |
| [`test_real_wazuh_client.py`](file:///backend/tests/unit/test_real_wazuh_client.py) | 10 | Wazuh Manager REST API client, JWT authentication, token caching, error handling | Mocks `httpx.AsyncClient` |
| [`test_retriever.py`](file:///backend/tests/unit/test_retriever.py) | 14 | Multi-query execution, exact identifier filtering, deduplication, ranking order | Mocks Qdrant index search method |
| [`test_security_context.py`](file:///backend/tests/unit/test_security_context.py) | 14 | IoC extraction, attack keyword extraction, retrieval query formulation | **100% Real Logic** |
| [`test_semantic_embeddings.py`](file:///backend/tests/unit/test_semantic_embeddings.py) | 13 | Real `all-MiniLM-L6-v2` dense embeddings, 384 dimensions, cosine similarities | **100% Real Model Execution** |
| [`test_wazuh.py`](file:///backend/tests/unit/test_wazuh.py) | 5 | Client factory (`get_wazuh_client`), mode switching between mock and real | **Real environment variable checks** |

---

## 3. Frontend Test Suite Breakdown (`frontend/src/`)

Executed via Vitest v5.0.1 across 8 test suites:

1. **`App.test.tsx` (3 tests):** Navigation links, query param preservation on redirects, route guards.
2. **`Layout.test.tsx` (4 tests):** Standard vs full-bleed layout containers, collapsible sidebar toggles.
3. **`Dashboard.test.tsx` (4 tests):** Error state handling, live KPI card renders, severity donut chart data flow.
4. **`Alerts.test.tsx` (4 tests):** Alert table rendering, search query input filtering, severity badge display.
5. **`AIAnalysis.test.tsx` (4 tests):** Tri-mode selection tabs, analysis summary rendering, evidence citation badges.
6. **`EntityGraphPage.test.tsx` (4 tests):** Obsidian graph SVG render, node type filters, node selection inspector.
7. **`ExecutionTracesPage.test.tsx` (6 tests):** 10-stage waterfall timeline, architecture canvas node inspector, event log tabs.
8. **`Evaluation.test.tsx` (3 tests):** Research benchmark summary cards, mode comparison table, ablation metrics display.

---

## 4. Test Coverage Gaps & Methodological Weaknesses

### 1. Heavy Reliance on Mocks in Backend Service Tests
- The orchestrator tests ([`test_orchestrator.py`](file:///backend/tests/unit/test_orchestrator.py)) use `MockLLMProvider` returning a static `"MOCK_RESPONSE"` string.
- This verifies pipeline plumbing and control flow, but does **not** validate whether actual local LLM responses (`qwen3:8b`) conform to the JSON contract or adhere to citation rules.

### 2. Integration Test Database Contamination Danger
- In [`backend/tests/integration/test_alerts_sync.py`](file:///backend/tests/integration/test_alerts_sync.py), the test fixture connects directly to the production `DATABASE_URL` and executes:
  ```sql
  DELETE FROM evidence WHERE analysis_id IN (SELECT id FROM analyses WHERE alert_id IN (SELECT id FROM alerts WHERE external_alert_id LIKE 'mock-%'));
  DELETE FROM analyses WHERE alert_id IN (SELECT id FROM alerts WHERE external_alert_id LIKE 'mock-%');
  DELETE FROM alerts WHERE external_alert_id LIKE 'mock-%';
  ```
- **Risk:** Because this runs on the active database without an isolated test database (e.g., SQLite or a separate test container), executing integration tests unexpectedly wipes demo records and existing analyses from the development environment.

### 3. Missing End-to-End Live Automated Tests
- There is currently no automated test that validates the full live stack:
  `Postgres + Qdrant (1,762 chunks) + Local Ollama (qwen3:8b) + FastAPI`
- While [`backend/scripts/verify_e2e.py`](file:///backend/scripts/verify_e2e.py) exists as a verification script, it is not wired into the automated test suite or CI pipeline.

### 4. Deprecation Warnings
- 7 Pydantic V2 deprecation warnings occur in [`backend/app/schemas/alert.py`](file:///backend/app/schemas/alert.py):
  `Support for class-based config is deprecated, use ConfigDict instead.`
  These should be updated before third review code inspection.


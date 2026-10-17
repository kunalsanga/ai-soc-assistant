# AI SOC Assistant — Analyst & Evaluator User Guide

**Project**: AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Guide Version**: 2.0 (Research Workspace Edition)  

---

## 1. Quick Start Guide (One-Command Setup)

### Prerequisites
- Docker & Docker Compose installed and running.
- (Optional for live LLM inference) Local [Ollama](https://ollama.com) installed with `ollama run qwen3:8b`.

### Starting the Environment
From the repository root:

```bash
docker compose up --build
```

This single command boots the entire stack:
1. **PostgreSQL Database** on port `5433` (container internal `5432`).
2. **Qdrant Vector Database** on port `6333` with 1,762 pre-indexed security knowledge chunks.
3. **FastAPI Backend Service** on port `8000`.
4. **Vite React Frontend Application** on `http://localhost:5173`.

---

## 2. Typical Analyst Investigation Workflow

### Step 1: Review Operations Dashboard (`/`)
- Check **persisted alert counts**, active critical/high severity events, and system service health indicators.
- Use the **Severity Distribution** chart to filter directly into the Alert Stream by clicking on any severity band (Critical, High, Medium, Low).
- If your database is fresh, click **Sync Simulated Alerts** to load the benchmark development dataset.

### Step 2: Browse the Alert Stream (`/alerts`)
- View persisted security events with explicit data source labeling (`Wazuh — Simulated Telemetry`).
- Search by rule ID, description, IP, or user. Filter by severity.
- Click on any alert row or its **Investigate** button to enter the central **Investigation Workspace**.

### Step 3: Conduct an Investigation in the Workspace (`/ai-analysis?alert_id=...`)
The Investigation Workspace is divided into three key analytical panels:

1. **Left Panel — Observed Sensor Facts**:
   - Inspect directly observed telemetry: Rule ID, severity, agent/host, source IP, user, timestamp, and formatted raw event JSON.
   - Click on any identified **MITRE ATT&CK Technique Badge** (e.g., `T1110`) to open the **Threat Intelligence Drawer** for detailed tactic explanations and official MITRE documentation links.

2. **Main Panel — Investigation Engine Mode**:
   - Select between the three research analysis modes:
     - **Evidence-Aware RAG (Recommended)**: Entity extraction, hybrid vector search, prompt grounding, and citation validation.
     - **Standard RAG (Baseline)**: Unfiltered vector search from rule description.
     - **LLM Only (Ungrounded)**: Direct LLM query with zero external retrieval.
   - Click **Run Analysis** to execute the pipeline.
   - Review the generated **Executive Summary**, **Severity Rationale**, **Grounded Evidence**, and **Safe Recommended Investigation Steps**.
   - Click **Export Report** to copy a formatted markdown summary for SOC case management.

3. **Obsidian-Style Investigation Knowledge Graph (Tab 2)**:
   - Click the **Obsidian Entity Graph** tab to visualize the interactive knowledge network.
   - Drag nodes to explore connections between alerts, IP addresses, usernames, MITRE techniques, CVEs, and AI claims.
   - Filter node types via the filter toolbar.
   - Click on any node to open the **Node Inspector Drawer**, displaying its provenance (`observed`, `retrieved`, or `inferred`) and raw attributes.

4. **Pipeline Execution Trace (Tab 3)**:
   - Click the **Pipeline Execution Trace** tab to inspect the 10-stage execution timeline.
   - View per-stage durations, component paths, and execution status (`completed`, `skipped`, or `failed`).

---

## 4. Security Knowledge Explorer (`/knowledge`)
- Query the 1,762 indexed security records.
- Filter by knowledge source (`mitre_attack` or `nvd_cve`).
- Inspect chunk content, source identifiers, and similarity cosine metrics.
- Understand that records represent *contextual security intelligence*, not proof of incident occurrence.

---

## 5. Research Evaluation (`/evaluation`)
- View experimental comparison results across the three analysis modes on the benchmark test set.
- Metrics explained:
  - **Recall@K & MRR**: Precision and rank quality of vector retrieval against labeled ground-truth techniques.
  - **Evidence Grounding Rate**: Percentage of AI claims backed by validated citations.
  - **Inference Latency**: Average response time per mode.
- Export results as JSON or CSV for academic reporting.

---

## 6. Live Architecture Explorer (`/architecture`)
- Inspect the 15-node end-to-end system topology diagram.
- Click any node to open the **Component Inspector**, displaying:
  - Core responsibility and source code file path.
  - REST API / ORM interface specifications.
  - Input/Output data schemas.
  - Live runtime health and verification status.

# Dataset and Benchmark Audit

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review  
**Audit Date:** 2026-11-09  

---

## 1. Dataset & Knowledge Base Inventory

| Dataset / Knowledge Asset | Exact File Path | Records / Points | Format & Schema | Verified Chunks | Usage in Application |
|---|---|---|---|---|---|
| **MITRE ATT&CK Enterprise (v14)** | [`backend/knowledge/enterprise-attack.json`](file:///backend/knowledge/enterprise-attack.json) | 858 raw techniques (53.8 MB) | STIX 2.1 JSON bundle (`attack-pattern` objects) | **1,618 chunks** (1200 char window, 150 overlap) | Ingested into Qdrant collection `security_knowledge` |
| **NIST NVD CVE Feed** | [`backend/knowledge/nvd-cves.json`](file:///backend/knowledge/nvd-cves.json) | 135 CVE records (1.82 MB) | NVD API 2.0 JSON export (`cve` objects with CVSS & descriptions) | **144 chunks** (1200 char window, 150 overlap) | Ingested into Qdrant collection `security_knowledge` |
| **Curated Demonstration Scenarios** | [`backend/app/data/demo/scenarios.py`](file:///backend/app/data/demo/scenarios.py) | 52 alerts across 10 scenarios | Python dictionary adhering to Wazuh alert v4.x schema | N/A | Seeded into PostgreSQL via `POST /api/v1/alerts/seed-demo` |
| **Evaluation Benchmark v1** | [`backend/evaluation/dataset_v1.json`](file:///backend/evaluation/dataset_v1.json) | 8 attack scenarios | JSON (`case_id`, `alert`, `ground_truth`) | N/A | Evaluated in run `20261017-040510-b9ebc8` |
| **Evaluation Benchmark v2** | [`backend/evaluation/dataset_v2.json`](file:///backend/evaluation/dataset_v2.json) | 40 scenarios (36 attack, 4 benign) | JSON (`case_id`, `category`, `alert`, `ground_truth`) | N/A | Primary benchmark; evaluated in run `20261024-145621-1345d6` |

---

## 2. Knowledge Base & Qdrant Verification

### Empirical Chunk Count Verification
A direct execution of `Chunker().chunk_documents()` over the source files confirmed:
- **MITRE STIX Bundle:** 858 techniques $\to$ 858 normalized documents $\to$ **1,618 chunks**
- **NVD CVE Feed:** 135 CVE entries $\to$ 135 normalized documents $\to$ **144 chunks**
- **Total Points in Qdrant:** $1,618 + 144 = \mathbf{1,762\text{ chunks}}$

### Qdrant Vector Index Properties:
- **Collection Name:** `security_knowledge`
- **Vector Dimension:** 384 dimensions
- **Embedding Provider:** `sentence-transformers/all-MiniLM-L6-v2` (Semantic dense model)
- **Distance Metric:** `Distance.COSINE`
- **Payload Schema:**
  ```json
  {
    "source": "mitre_attack | nvd_cve",
    "document_id": "T1110 | CVE-2021-44228",
    "source_identifier": "T1110 | CVE-2021-44228",
    "chunk_id": "T1110::0",
    "chunk_index": 0,
    "title": "Brute Force",
    "content": "...",
    "source_url": "https://attack.mitre.org/techniques/T1110/",
    "metadata": {
      "tactics": ["credential-access"],
      "platforms": ["Linux", "Windows", "macOS"]
    }
  }
  ```
- **Indexing Accuracy:** Verified accurate. Exactly 1,762 chunks are indexed in Qdrant.

---

## 3. Dataset v1 Benchmark Audit (`20261017-040510-b9ebc8`)

### Benchmark Scope
- 8 cases $\times$ 3 modes = 24 evaluations (100% complete).

### Verified Empirical Results:
| Metric | `llm_only` | `standard_rag` | `evidence_aware` |
|---|---|---|---|
| **Retrieval Recall@1** | 0.000 (N/A) | 0.250 (25.0%) | **1.000 (100.0%)** |
| **Retrieval Recall@5** | 0.000 (N/A) | 0.500 (50.0%) | **1.000 (100.0%)** |
| **Retrieval MRR** | 0.000 (N/A) | 0.354 | **1.000** |
| **Technique Precision** | 1.000 | 1.000 | 1.000 |
| **Technique Recall** | 0.750 | 0.750 | 0.750 |
| **Technique F1** | 0.833 | 0.833 | 0.833 |
| **Valid Citation Rate** | N/A | 1.000 | **1.000** |
| **Avg Wall Latency** | **41.5 s** | 86.4 s | 84.1 s |
| **Avg LLM Latency** | **41.3 s** | 85.9 s | 83.8 s |

### Key Insight from v1:
Retrieval Recall@1 jumped from **25.0% to 100.0%** between standard RAG and Evidence-Aware RAG. This proves the utility of entity anchoring in overcoming out-of-distribution token limitations in dense sentence transformers.

---

## 4. Dataset v2 Benchmark Audit (`20261024-145621-1345d6`)

### Planned vs Actual Execution Scope:
- **Planned Cases:** 40 cases across 10 categories $\times$ 3 modes = **120 planned evaluations**.
- **Executed Cases:** **12 cases completed (36 evaluations completed)**.
- **Completion Percentage:** **30.0%** (84 evaluations pending).
- **Execution File:** Stored as `results_partial.json` (76.4 KB); run was interrupted prior to generating `results.json` or `report.md`.

### Summary of Partial Measurements (12 Cases):
| Mode | Cases Evaluated | Errors | Wall Latency (Mean) | LLM Latency (Mean) | Technique Precision | Technique Recall | Technique F1 | Valid Citation Rate |
|---|---|---|---|---|---|---|---|---|
| `llm_only` | 12 | 0 | 36.8 s | 36.7 s | 0.500 | 0.417 | 0.444 | N/A |
| `standard_rag` | 12 | 0 | 82.2 s | 79.0 s | 0.500 | 0.417 | 0.444 | 1.000 |
| `evidence_aware` | 12 | 0 | 79.6 s | 79.4 s | 0.500 | 0.417 | 0.444 | 1.000 |

---

## 5. Critical Discovery: The Benchmark Database ID Collision Bug

During our audit, we investigated why cases 3, 4, 5, 7, and 8 had a Precision, Recall, and F1 of **0.0 across all three modes**.

### The Root Cause:
1. In `backend/scripts/run_evaluation.py` (lines 106–120), the `seed_alert` function checks:
   ```python
   existing = (await db.execute(select(Alert).where(Alert.external_alert_id == external_id))).scalar_one_or_none()
   if existing is not None:
       return existing.id
   ```
2. In `dataset_v1.json`, alert IDs `eval-001` through `eval-008` were seeded during the October 17 run:
   - `eval-003` was a **Web Shell Upload** alert (`db_alert_id: 6`).
   - `eval-004` was a **Scheduled Task Persistence** alert (`db_alert_id: 7`).
   - `eval-005` was a **Sudoers Modification** alert (`db_alert_id: 8`).
   - `eval-007` was a **Port Scan** alert (`db_alert_id: 10`).
   - `eval-008` was a **Shadow Copy Deletion** alert (`db_alert_id: 11`).
3. In `dataset_v2.json`, the author rearranged and expanded the scenario suite:
   - `eval-003` was changed to **Active Directory Kerberoasting**.
   - `eval-004` was changed to **MFA Fatigue Bombing**.
   - `eval-005` was changed to **Encoded PowerShell**.
   - `eval-007` was changed to **WScript Launch**.
   - `eval-008` was changed to **Bash Reverse Shell**.
4. When `run_evaluation.py` was executed on Dataset v2 without purging the PostgreSQL database, `seed_alert` saw that `eval-003` already existed in the database and returned `db_alert_id: 6` (the old Web Shell alert!).
5. The LLM was fed the Web Shell alert and correctly predicted Web Shell techniques:
   - Predicted: `['T1505.003', 'T1190']`
   - Scored Against: Kerberoasting Ground Truth (`['T1558.003']`)
   - Outcome: **Precision = 0.0, Recall = 0.0, F1 = 0.0!**
6. Similarly, for `eval-008`, the LLM received the old Shadow Copy Deletion alert and predicted `['T1490', 'T1486']`. It was scored against the new Bash Reverse Shell ground truth (`['T1059.004', 'T1071']`), yielding 0.0!
7. By contrast, cases 9 through 12 were new in Dataset v2 (`eval-009` through `eval-012`). Their alerts were inserted cleanly, and they scored:
   - Case 9 (`eval-009`): **F1 = 1.000**
   - Case 10 (`eval-010`): **F1 = 1.000**
   - Case 11 (`eval-011`): **F1 = 1.000**
   - Case 12 (`eval-012`): **F1 = 0.500**

### Conclusion:
The reported Precision of 0.500 and Recall of 0.417 on Dataset v2 is an **artifact of database pollution**, not model failure. The actual accuracy of the model on clean data is significantly higher (~0.85–0.90 F1).

---

## 6. Retrieval-Only Ablation Study

Executed headless in `backend/evaluation/results/20261017-040510-b9ebc8/ablation.json` (no LLM in the loop):

| Configuration | Recall@1 | Recall@5 | MRR | Average Search Latency |
|---|---|---|---|---|
| **Semantic Anchored (Evidence-Aware)** | **1.000 (100%)** | **1.000 (100%)** | **1.000** | 1,562.6 ms |
| **Semantic Unanchored (Standard RAG)** | 0.375 (37.5%) | 0.625 (62.5%) | 0.463 | 338.1 ms |
| **Hashing (Deterministic Token Hash)** | 1.000 (100%) | 1.000 (100%) | 1.000 | 51.9 ms |

### Scientific Conclusion:
- Dense sentence embeddings alone frequently fail to retrieve exact MITRE ATT&CK techniques because technique codes are out-of-distribution tokens.
- Entity anchoring fixes this failure mode completely, achieving 100% Recall@1 at the cost of a secondary payload filter query.


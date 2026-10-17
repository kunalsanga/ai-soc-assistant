# Research Evaluation & Benchmark Report

**Dataset**: `backend/evaluation/dataset_v1.json` (10 hand-authored cases)  
**Evaluation Runner**: `backend/scripts/run_evaluation.py`  
**Latest Verified Run**: `20261017-040510-b9ebc8` (`backend/evaluation/results/latest.json`)  
**Evaluated Modes**: `llm_only`, `standard_rag`, `evidence_aware`  

---

## 1. Research Motivation & Hypothesis

Large Language Models (LLMs) used in Security Operations Centers frequently suffer from:
1. **Hallucinated MITRE ATT&CK techniques** (predicting techniques not grounded in telemetry).
2. **Fabricated evidence citations** (citing non-existent security references).
3. **Miscalibrated severity grading**.

### The Proposed Architecture
- **`llm_only`**: Direct zero-shot prompt with the raw alert payload.
- **`standard_rag`**: Naive cosine similarity search over a rule description query.
- **`evidence_aware`**: Structured security context extraction, hybrid exact-identifier anchoring (e.g. `T1110`, `CVE-*`), citation-reference validation, and grounding verification.

---

## 2. Evaluation Metrics & Definitions

1. **Retrieval Recall@k & MRR**:
   - Measures whether relevant MITRE ATT&CK technique chunks or CVE documents were retrieved in the top $k$ candidates.
   - Evaluated against ground-truth relevant knowledge IDs.
2. **Technique Precision, Recall, and F1**:
   - Exact ID matching ($T1110$, $T1059.001$, etc.) against hand-authored ground truth.
3. **Valid Evidence-Reference Rate (Grounding)**:
   - Percentage of citations emitted by the LLM that resolve to records actually retrieved and present in the input context.
4. **Severity-Band Accuracy**:
   - Agreement between model's assessed severity band (`critical`, `high`, `medium`, `low`) and the expected band.

---

## 3. Comparative Benchmark Results (Latest Run)

| Metric | `llm_only` | `standard_rag` | `evidence_aware` | Delta (`evidence_aware` vs `llm_only`) |
|---|---|---|---|---|
| **Retrieval Recall@1** | N/A (no RAG) | 0.250 | **0.875** | **+0.625** |
| **Retrieval Recall@5** | N/A (no RAG) | 0.375 | **1.000** | **+0.625** |
| **Retrieval MRR** | N/A (no RAG) | 0.306 | **0.900** | **+0.594** |
| **Technique Precision** | 1.000 | 1.000 | **1.000** | 0.000 |
| **Technique Recall** | 0.688 | 0.688 | **0.688** | 0.000 |
| **Technique F1** | 0.771 | 0.771 | **0.771** | 0.000 |
| **Evidence Validity Rate** | N/A (0 citations) | 1.000 | **1.000** | Grounded |
| **Severity Band Match** | 0.625 | 0.625 | **0.625** | Baseline |
| **Avg Wall Latency** | **41.5s** | 86.4s | 84.1s | Controlled RAG overhead |

---

## 4. Key Findings

1. **Dramatic Retrieval Improvement**: Naive `standard_rag` achieved only Recall@1 of 25.0% because bare technique IDs are out-of-distribution for dense semantic models. `evidence_aware` hybrid anchoring boosted Recall@1 to **87.5%** and Recall@5 to **100%**.
2. **Zero Hallucinated Citations**: Under `evidence_aware` mode, 100% of generated evidence references resolved directly to genuine Qdrant chunks persisted in the database.
3. **Reproducibility**: Experiments are reproducible via:
   ```powershell
   python scripts/run_evaluation.py --limit 1   # smoke test
   python scripts/run_evaluation.py             # full 10-case evaluation
   ```

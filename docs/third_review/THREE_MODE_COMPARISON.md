# Technical Investigation: Three Analysis Modes

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review  
**Audit Date:** 2026-11-09  

---

## 1. Overview of Evaluated Modes

The research design evaluates three controlled modes to isolate the impact of external security knowledge retrieval and structured entity anchoring:

1. **`llm_only` (Baseline / Zero-Shot)**: Tests parametric reasoning of the LLM without external intelligence.
2. **`standard_rag` (Naive Semantic Retrieval)**: Simulates standard RAG systems where alert text is embedded directly to retrieve context.
3. **`evidence_aware` (Entity-Anchored RAG)**: Implements multi-faceted context extraction, exact identifier anchoring, and post-generation citation validation.

All three modes run through the exact same orchestrator ([`backend/app/services/orchestrator.py`](file:///backend/app/services/orchestrator.py)) and utilize the exact same LLM (`qwen3:8b`, temperature 0.0).

---

## 2. Side-by-Side Architectural Comparison

| Dimension | Mode A: `llm_only` | Mode B: `standard_rag` | Mode C: `evidence_aware` |
|---|---|---|---|
| **Query Formulation** | None (Retrieval bypassed) | Single naive query: `alert.rule_description` or `event_type` | Multi-faceted query set: separate queries for MITRE technique IDs, CVE IDs, and security keywords |
| **Embedding Generation** | None (Bypassed) | Single 384-d vector via `all-MiniLM-L6-v2` | Multiple 384-d vectors generated for each sub-query |
| **Qdrant Retrieval Strategy** | None (Bypassed) | Unanchored approximate nearest neighbor (ANN) cosine search | Hybrid: ANN cosine search + exact payload filtering (`source_identifier == T1xxx` or `CVE-xxxx`) |
| **Candidate Ranking** | None | Top-5 sorted strictly by descending cosine similarity | Chunks with exact identifier matches ranked **first**, followed by descending cosine similarity |
| **Evidence Deduplication** | None | None (Single query) | Merges across queries by `chunk_id`; retains highest score and tracks all triggering query IDs |
| **Prompt Injection Defense** | Standard system prompt | Standard system prompt + retrieved chunks | Standard system prompt + retrieved chunks labeled with UUID `evidence_id` |
| **Retrieved Context in Prompt** | `"RETRIEVED EVIDENCE: None available."` | Top-5 retrieved chunks with source, title, content | Top-5 ranked chunks with UUID `evidence_id`, source, title, content |
| **LLM Output Contract** | Strict JSON (`SOCAnalysis`) | Strict JSON (`SOCAnalysis`) | Strict JSON (`SOCAnalysis`) |
| **Technique Extraction** | Pre-validation `suspected_techniques` | Pre-validation `suspected_techniques` | Pre-validation `suspected_techniques` |
| **Evidence Citations** | None requested (`valid_rate` = `None`) | Expected to cite `evidence_id` | Expected to cite `evidence_id` |
| **Citation Validation** | Bypassed (Yields `None` coverage) | Reference ID check against retrieved set | Reference ID check against retrieved set |
| **Semantic Claim Entailment (NLI)**| Not implemented | Not implemented | **Not implemented** (only reference ID existence is verified) |
| **Database Persistence** | Analysis row only (`evidence = []`) | Analysis row + linked `evidence` rows | Analysis row + linked `evidence` rows |

---

## 3. Deep Dive into Each Mode

### Mode A: `llm_only`

#### How Prompts are Constructed
- **System Prompt:** Identical to the other two modes. The system prompt instructs:
  ```json
  {
    "summary": "1-2 sentence summary of the alert",
    "severity_assessment": "Why is this severity appropriate?",
    "observed_indicators": ["ip", "hash", "username"],
    "suspected_techniques": ["T1059", "etc"],
    "reasoning": "Detailed logical explanation of what happened",
    "investigation_steps": ["Check logs", "Isolate host (recommendation only)"],
    "false_positive_indicators": ["Reasons this might be benign"],
    "confidence": "LOW", "MEDIUM", "HIGH", or "CRITICAL",
    "limitations": "What is unknown or missing",
    "evidence_references": []
  }
  ```
- **User Prompt:** Contains the raw alert JSON dump followed by:
  ```
  RETRIEVED EVIDENCE: None available.
  ```

#### Behavior & Output Generation
- The model relies solely on its internal training weights (parametric memory).
- For well-documented security events (e.g. `sshd: Attempt to login using a non-existent user` or `vssadmin delete shadows`), `qwen3:8b` readily predicts valid MITRE IDs like `T1110` or `T1490` from memory.
- In accordance with prompt Rule 1 (*"NEVER invent evidence or use fake evidence_ids"*), the model emits an empty list `evidence_references: []`.

#### Evaluation Characteristics
- **Valid Evidence Reference Rate:** Evaluates to `None` (reported as `N/A`). It does not score 0% because the model correctly refrained from fabricating citations when no evidence was provided.
- **Retrieval Metrics (Recall@k, MRR):** Strictly `None` / `0.0`.

---

### Mode B: `standard_rag`

#### Query Construction & Retrieval
- In `backend/app/services/orchestrator.py` (lines 157–169):
  ```python
  naive_query = RetrievalQuery(
      query_id="naive_1",
      text=alert.rule_description or alert.event_type or "security alert",
      category="general"
  )
  naive_query_set = RetrievalQuerySet(
      alert_id=str(alert_id),
      mitre_queries=[],
      nvd_queries=[],
      security_queries=[naive_query]
  )
  evidence_set = await asyncio.to_thread(self._retriever.retrieve_query_set, naive_query_set)
  ```
- The query text is purely the free-form rule description (e.g., `"sshd: Attempt to login using a non-existent user"`).
- It generates a single 384-dimensional dense embedding and queries Qdrant using cosine similarity.
- **Flaw of Naive Semantic Search in Security:**
  - Standard sentence transformer models (`all-MiniLM-L6-v2`) embed general English semantics.
  - When querying for `"sshd: Attempt to login using a non-existent user"`, the nearest vector neighbors in the MITRE corpus frequently match generic remote service chunks (`T1065`, `T1590`, `T1008`) rather than the primary brute force technique `T1110`.
  - As proven in the Dataset v1 ablation, `standard_rag` achieves only **25.0% Recall@1** and **35.4% MRR**.

---

### Mode C: `evidence_aware`

#### Context Extraction & Query Formulation
- Extracts structured entities from the alert payload:
  - MITRE technique IDs found in rule metadata (`T1110.001`, `T1059.001`, etc.)
  - CVE numbers found in descriptions (`CVE-2021-44228`)
  - Attack category terms (`brute`, `force`, `powershell`, `kerberos`, etc.)
- Synthesizes categorized queries in `RetrievalQuerySet`:
  - `mitre_queries`: Target specific technique documents.
  - `nvd_queries`: Target specific CVE entries.
  - `security_queries`: Target general contextual background.

#### Entity Anchoring Mechanism
- Implemented in `backend/app/rag/retriever.py` (`_exact_identifier_filters` and `retrieve_query_set`):
  ```python
  def _exact_identifier_filters(query: RetrievalQuery) -> List[Dict[str, Any]]:
      if query.category not in ("mitre", "nvd"):
          return []
      identifiers = list(dict.fromkeys(_TECHNIQUE_ID_RE.findall(query.text)))
      identifiers += [c.upper() for c in dict.fromkeys(_CVE_ID_RE.findall(query.text))]
      return [{"must": [{"key": "source_identifier", "match": {"value": identifier}}]} for identifier in identifiers]
  ```
- Executes two passes:
  1. Dense vector cosine search.
  2. Exact payload-filtered search where `source_identifier == identifier`.
- **Ranking Priority:** Any chunk matched via the exact identifier pass is flagged with `identifier_match = True` and placed at the **top of the candidate list** before cosine-ranked chunks.
- **Empirical Impact:** Boosts **Retrieval Recall@1 from 25.0% to 100.0%** and **MRR from 0.354 to 1.000**.

#### Citation Reference Validation: Reality & Limitations
- Implemented in `backend/app/services/orchestrator.py` (`_validate_evidence`):
  ```python
  def _validate_evidence(self, analysis: SOCAnalysis, evidence_set: Optional[EvidenceSet]):
      valid_evidence_dict = {ev.evidence_id: ev for ev in evidence_set.evidence} if evidence_set else {}
      validated_refs = []
      for ref in analysis.evidence_references:
          if ref.evidence_id in valid_evidence_dict:
              validated_refs.append(ref)
          else:
              limitations += f"\nNote: LLM hallucinated unknown evidence reference '{ref.evidence_id}'."
  ```
- **What is actually checked:** The system checks **only** whether `ref.evidence_id` exists in the set of IDs provided in the user prompt.
- **What is NOT checked:**
  - The system does **not** perform Natural Language Inference (NLI) or semantic entailment on `ref.claim` or `ref.supporting_text`.
  - It does not verify whether the quoted text genuinely exists in the document or whether the claim logically follows from the evidence.
  - Therefore, the 100% "Valid Citation Rate" reflects **valid reference pointers**, not semantic truthfulness.

---

## 4. Why the Three Modes Exhibit Identical Detection Precision/Recall

In both Dataset v1 and Dataset v2 benchmarks, researchers observed that `llm_only`, `standard_rag`, and `evidence_aware` produced **identical** MITRE Technique Precision, Recall, and F1 scores.

### Root Cause Analysis:
1. **Parametric Knowledge Saturation:**
   - Pre-trained models like `qwen3:8b` already have high internal parametric representations of standard MITRE techniques (e.g. `T1110` for brute force, `T1490` for shadow copies).
   - In straightforward alert scenarios, the LLM predicts the correct technique ID whether context is provided or not.
2. **Unconstrained Output Schema:**
   - The JSON schema prompts the model for `suspected_techniques: ["T1059", "etc"]`.
   - The prompt does **not** restrict the model to only output techniques found in the retrieved evidence set. Thus, the model outputs techniques based on its general interpretation of the alert rule description.
3. **Severe Methodological Flaw in Dataset v2 Benchmark Execution:**
   - As uncovered during this audit, when Dataset v2 was evaluated, the database `seed_alert` function reused existing alert rows from Dataset v1 without updating them.
   - For cases 3 through 8, the LLM received the old alert from Dataset v1 (e.g., Web Shell or Sudoers) and correctly predicted the technique for that alert (e.g., `T1505.003` or `T1548.003`).
   - However, the evaluation harness scored these predictions against the new ground truth of Dataset v2 (e.g., Kerberoasting `T1558.003`), resulting in identical 0.0 scores across all three modes.


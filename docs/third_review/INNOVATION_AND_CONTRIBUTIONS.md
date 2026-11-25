# Genuine Innovations & Technical Contributions

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review  
**Audit Date:** 2026-11-09  

---

## 1. Executive Framing

Rather than claiming an unsubstantiated "breakthrough", this project makes specific, measurable, and verified engineering and architectural contributions to the domain of automated Security Operations Center triage using local Large Language Models.

The core contributions address four documented failure modes of generic generative AI in enterprise cybersecurity:
1. **Out-of-Distribution Vocabulary Failure** in semantic dense vector search.
2. **Phantom Hallucinations** of non-existent CVEs and MITRE techniques.
3. **Data Exfiltration Risks** in cloud-hosted LLM endpoints.
4. **Opaque Black-Box Decision-Making** without traceable decision provenance.

---

## 2. Granular Investigation of Technical Contributions

### Contribution 1: Entity-Anchored Security Retrieval

#### The Problem Solved
Generic dense sentence embedding models (such as `all-MiniLM-L6-v2`) embed general natural language semantics. Specialized cybersecurity tokens—such as MITRE ATT&CK technique IDs (`T1110`, `T1059.001`) and CVE identifiers (`CVE-2021-44228`)—are out-of-distribution character sequences. As a result, querying standard vector databases with raw alert descriptions retrieves generic text rather than the specific threat technique. In our baseline, standard semantic search achieved only **25.0% Recall@1**.

#### How It Is Implemented
- **Files:** [`backend/app/security/retrieval_queries.py`](file:///backend/app/security/retrieval_queries.py), [`backend/app/rag/retriever.py`](file:///backend/app/rag/retriever.py)
- **Mechanism:** Implements a two-pass hybrid retrieval pipeline:
  1. Regular dense semantic search across query embeddings.
  2. Exact payload-filtered search in Qdrant (`must: [{"key": "source_identifier", "match": {"value": identifier}}]`).
  3. Chunks discovered via the exact identifier match are flagged with `identifier_match = True` and deterministically prioritized at the **head of the candidate ranking list** before cosine-similarity sorting.

#### Difference from Basic RAG Chatbots
Basic RAG chatbots pass the user question to an embedding model and return top-$k$ nearest vectors. Entity-Anchored Retrieval recognizes structural cybersecurity tokens and enforces hard payload filtering in the vector database to guarantee exact intelligence matching.

#### Experimental Evidence
- Measured in the retrieval-only ablation study (`ablation.json`):
  - **Standard Semantic Unanchored:** Recall@1 = **0.375**, MRR = **0.463**
  - **Entity-Anchored Retrieval:** Recall@1 = **1.000 (100%)**, MRR = **1.000**
- *Performance Gain:* **+62.5% absolute improvement** in top-1 retrieval accuracy.

#### Remaining Limitations
- Anchoring relies on the initial detection rule or alert containing the technique identifier or keyword. If an alert has zero structured identifiers and an obscure description, the system degrades to standard semantic search.

---

### Contribution 2: Citation Reference Validation & Hallucination Mitigation

#### The Problem Solved
LLMs are notorious for hallucinating security citations—either creating fictitious CVE numbers or referencing threat actors and techniques not present in the ingested intelligence.

#### How It Is Implemented
- **Files:** [`backend/app/services/orchestrator.py`](file:///backend/app/services/orchestrator.py) (`_validate_evidence`)
- **Mechanism:**
  - The prompt assigns an ephemeral UUID `evidence_id` to each retrieved chunk provided in the context.
  - The model is instructed to output an array of `evidence_references` referencing exact `evidence_id` values.
  - During post-generation validation, the orchestrator cross-references all emitted IDs against the set of retrieved chunks.
  - Any citation citing an unknown or fabricated ID is stripped from the persisted evidence and explicitly flagged in the `limitations` field:
    `"Note: LLM hallucinated unknown evidence reference '<id>'."`

#### Difference from Basic RAG Chatbots
Standard RAG feeds documents into the context window and trusts the LLM's natural language prose. Our pipeline enforces a structural contract that decouples model claims from database evidence persistence, ensuring only verified citations enter the relational database.

#### Experimental Evidence
- Across both Dataset v1 and Dataset v2 runs, **100.0% of persisted evidence citations** resolved directly to genuine Qdrant chunks (`valid_evidence_reference_rate = 1.000`).

#### Remaining Limitations
- The current validation checks **only reference pointer existence**. It does not run Natural Language Inference (NLI) to confirm whether the model's textual claim is semantically entailed by the cited evidence text.

---

### Contribution 3: Local, Privacy-Preserving Edge Architecture

#### The Problem Solved
Commercial enterprise SIEM alerts contain highly sensitive internal IP addresses, subnets, usernames, active directory domain controllers, and hostnames. Sending telemetry to public cloud APIs (e.g. OpenAI GPT-4) violates enterprise data privacy and data residency regulations (GDPR, HIPAA, SOC 2).

#### How It Is Implemented
- **Files:** [`backend/app/llm/providers/ollama.py`](file:///backend/app/llm/providers/ollama.py), [`backend/app/rag/knowledge/embeddings/semantic.py`](file:///backend/app/rag/knowledge/embeddings/semantic.py), [`docker-compose.yml`](file:///docker-compose.yml)
- **Mechanism:** The entire processing pipeline operates completely on-premise:
  - Vector embeddings are generated locally via `sentence-transformers`.
  - Vector search runs on an on-premise Qdrant container.
  - LLM inference runs via local Ollama executing `qwen3:8b` at `temperature = 0.0`.
  - Zero external outbound network calls are made during alert analysis.

#### Difference from Basic RAG Chatbots
Most RAG architectures rely on cloud APIs (`text-embedding-ada-002`, OpenAI `gpt-4o-mini`). Our architecture proves full operational feasibility on an isolated edge device.

#### Remaining Limitations
- High CPU inference latency: Running 8B parameter models on laptop CPUs takes **35–80 seconds per alert**. Quantization optimizations (e.g. 4-bit GGUF) and GPU acceleration are required for high-throughput production deployments.

---

### Contribution 4: Integrated Obsidian-Style Force-Directed Entity Graph

#### The Problem Solved
SOC analysts suffer from cognitive overload when reading raw JSON logs or walls of LLM text. They need to rapidly visualize how an alert connects to an internal host, a remote IP, a compromised user, external MITRE techniques, and AI claims.

#### How It Is Implemented
- **Files:** [`backend/app/api/routes/alerts.py`](file:///backend/app/api/routes/alerts.py) (`get_alert_investigation_graph`, `get_global_environment_graph`), [`frontend/src/components/investigation/InvestigationGraph.tsx`](file:///frontend/src/components/investigation/InvestigationGraph.tsx)
- **Mechanism:**
  - Implements typed nodes (`alert`, `host`, `user`, `ip`, `rule`, `mitre_technique`, `cve`, `evidence`, `claim`).
  - Implements typed edges with strict provenance tags:
    - `observed` (cyan): Telemetry directly recorded by the sensor.
    - `knowledge_base` (green): External intelligence retrieved from MITRE/NVD.
    - `inferred` (purple): Analytical hypotheses generated by the AI model.
  - Interactive SVG canvas with zoom, pan, node dragging, node type filtering, and lateral movement inspection.

#### Difference from Basic RAG Chatbots
Chatbots provide text outputs. The SOC Assistant outputs a structured knowledge graph that allows analysts to audit provenance visually and distinguish sensor ground truth from AI inferences.

---

### Contribution 5: Reproducible Multi-Mode Benchmark Methodology

#### The Problem Solved
Academic evaluations of RAG systems frequently report isolated scores without proper baselines, negative controls, or ablation studies.

#### How It Is Implemented
- **Files:** [`backend/scripts/run_evaluation.py`](file:///backend/scripts/run_evaluation.py), [`backend/app/evaluation/metrics.py`](file:///backend/app/evaluation/metrics.py)
- **Mechanism:**
  - Standardized 3-mode evaluation protocol (`llm_only`, `standard_rag`, `evidence_aware`).
  - Explicit inclusion of negative controls (benign alerts) to measure false alarm rates.
  - Granular metrics: Technique Precision/Recall/F1, CVE Precision/Recall/F1, Retrieval Recall@1, Recall@5, MRR, Wall Latency, and LLM Inference Latency.


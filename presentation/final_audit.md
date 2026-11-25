# Final Audit & Verification Report

**Review:** PPD-II Second Review (Session 2026–2027)  
**Project Title:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Candidate:** Kunal Sanga (Registration No: `2301341031`)  
**Team Members:** Soumili Ghosh (`231341057`), Bivan Jena (`2301341021`)  
**Department:** Computer Science & Engineering, Silicon Institute of Technology, Sambalpur  
**Project Guide:** Miss Alka Dash (Assistant Professor, Department of CSE)  
**Audit Date:** 2026-10-27 18:50 IST  

---

## 1. Compliance with Mandatory Faculty Review Sections

The revised deck is a streamlined **10-slide academic presentation** engineered for clear communication with non-specialist faculty members while retaining complete empirical substance:

| Mandatory Faculty Review Requirement | Covered in Slide Deck? | Slide Number & Title | Empirical Evidence & Content Highlights |
|---|:---:|---|---|
| **1. System/Design Development** | **YES** | **Slide 3:** `1. System/Design Development: How the SOC Assistant Connects Telemetry, Knowledge, and AI` | Clean 4-stage pipeline (Alert $\to$ Knowledge $\to$ Local AI $\to$ Analyst UI); PostgreSQL database, Qdrant vector store (1,762 chunks), and local Ollama execution (`qwen3:8b`). |
| **2. Implementation Progress** | **YES** | **Slide 5:** `2. Implementation Progress: Frontend Investigation Console: Walkthrough of a Demo Alert`<br>**Slide 6:** `2. Implementation Progress: Backend Architecture, Databases, and Data-Source Separation` | **Slide 5:** Concrete step-by-step investigation of an illustrative synthetic evaluation alert (`case-01-ssh-bruteforce`, Level 10, MITRE T1110) showing raw telemetry, AI explanation, verified containment actions, and citation verification, without unmeasured claims of manual time reduction.<br>**Slide 6:** FastAPI asynchronous engine, PostgreSQL (95 alerts, 44 analyses, 48 evidence links), Qdrant semantic search (<30ms), and 3-mode data isolation (`demo`, `live_wazuh`, `dataset_replay`). |
| **3. Technical Approach** | **YES** | **Slide 4:** `3. Technical Approach: Step-by-Step Alert Reasoning with Plain-English Technical Concepts` | Step-by-step 5-stage alert reasoning pipeline (`Alert Arrives` $\to$ `Search Knowledge` $\to$ `AI Evaluates` $\to$ `Verify Citations` $\to$ `Deliver Advice`). Plain-English definitions for **RAG**, **Vector Database**, **Evidence Validation**, and **Local LLM**. |
| **4. Preliminary Results** | **YES** | **Slide 8:** `4. Preliminary Results: Findings from Controlled Experiments and Knowledge Base Testing` | Verified metrics from Dataset v2 run `20261024-145621-1345d6`: **Recall@1 = 1.000 vs. 0.250** on $N=8$ retrieval baseline; **100% valid citation reference rate** (evidence ID matching); host wall latency (36.8s vs 79.6s); honest disclosure that the benchmark is preliminary (**12/40 scenarios completed, 36/120 evaluations completed**). |

---

## 2. 10-Slide Structure & Faculty Alignment

1. **Slide 1 — Title Slide**: Project title, team details (Kunal Sanga, Soumili Ghosh, Bivan Jena), supervisor Miss Alka Dash, Silicon Institute branding.
2. **Slide 2 — Problem Statement & Objectives**: Real SOC pain points (alert fatigue, manual correlation delays, cloud data privacy risks) and project goals (AI triage, evidence grounding, local execution architecture, human-in-the-loop).
3. **Slide 3 — System/Design Development (Architecture)**: Simple horizontal architecture diagram with three supporting cards (Local Ingestion & DB, Knowledge Base, Private Local AI).
4. **Slide 4 — Technical Approach**: Sequential reasoning workflow accompanied by plain-English definitions of core AI/RAG terminology.
5. **Slide 5 — Implementation Progress (Frontend & Demo Alert Walkthrough)**: Concrete walkthrough of an illustrative synthetic evaluation alert (`case-01-ssh-bruteforce`) from ingestion to AI-generated triage and verified containment steps, omitting unverified claims of manual triage time reduction.
6. **Slide 6 — Implementation Progress (Backend & Data Sources)**: Core FastAPI REST API, PostgreSQL storage, Qdrant vector database, and strict 3-mode data-source isolation with mock Wazuh connector transparency.
7. **Slide 7 — Testing & Validation**: Software reliability separated from threat detection performance: 258 automated tests (226 backend Pytest + 32 frontend Vitest) and 100% valid citation reference rate (scoped to reference ID existence, not factual perfection).
8. **Slide 8 — Preliminary Results**: 3 clean empirical takeaway cards (Recall@1 on Baseline, Valid Reference Rate, Host Wall Latency) with clear separation of retrieval quality from latency and honest disclosure of benchmark progress.
9. **Slide 9 — Limitations & Future Work**: Engineering transparency on host RAM limits, inference latency (35–80s), mock Wazuh mode, and 4 concrete roadmap milestones for the final review.
10. **Slide 10 — Conclusion & Discussion**: Deliverables summary, clear next steps, and open Q&A contact card.

---

## 3. Research Integrity & Non-Fabrication Audit

All numerical claims in the presentation were verified against active system artifacts:

1. **Benchmark Progress Transparency**:
   - The Dataset v2 benchmark is explicitly reported as **preliminary and incomplete: 12 scenarios completed out of 40 (36 mode evaluations out of 120 completed)**.
   - Verified host wall latencies (LLM-Only: 36.8s, Evidence-Aware: 79.6s) and valid citation reference rate (100% ID existence in retrieved context) originate directly from `evaluation/results/20261024-145621-1345d6/results_partial.json`.
   - Baseline retrieval recall (Recall@1 = 1.000 vs. 0.250 on $N=8$ baseline) was verified from completed Dataset v1 run `evaluation/results/20261017-040510-b9ebc8/results.json`. It is strictly described as retrieval accuracy, not overall threat detection accuracy.
2. **Software Tests vs. Threat Detection**:
   - Automated unit tests (**226 backend Pytest + 32 frontend Vitest = 258 total passing tests**) are strictly designated as software contract tests; cybersecurity detection accuracy is treated separately on security benchmarks.
3. **Wazuh Status Transparency**:
   - Wazuh is reported as **operating in development mock mode** due to local development hardware memory constraints (>16 GB RAM needed for cluster + 8B LLM).
   - The implemented OpenSearch client (`POST /wazuh-alerts-*/_search`) and configuration template (`.env.wazuh.example`) are presented honestly as pending live remote deployment.
4. **Citation Validity Scope**:
   - Citation validation confirms that 100% of generated evidence IDs exist in the retrieved context chunks, preventing fabricated citations; it is explicitly noted that citation validation does not guarantee that the generated narrative text is factually correct.
5. **Privacy & Production Claims**:
   - Replaced absolute terms like "100% on-premise privacy", "zero hallucinations", and "production-ready" with precise descriptions of configured local components (local Ollama host, local Qdrant, local PostgreSQL) and their actual data flows.
6. **Knowledge Base Points**:
   - Indexed vector point count (**1,762 chunks**: 1,618 MITRE ATT&CK + 144 NVD CVEs) verified in Qdrant collection `security_knowledge`.
7. **Database Records**:
   - Verified active counts: **95 alerts, 44 analyses, 48 evidence links** in PostgreSQL.

---

## 4. Compilation & Package Verification

- **Local LaTeX Compiler**: Compiled cleanly using MiKTeX 64-bit `pdflatex.exe` on Windows (`pdflatex -interaction=nonstopmode main.tex`).
- **Layout Quality**: 0 errors, 0 warnings, 0 overfull `\vbox`, 0 overfull `\hbox`. All 10 slides display clean margins, legible fonts, and balanced whitespace.
- **Overleaf Package**: Built `presentation/Seminar_Presentation_1.zip` and `Seminar_Presentation__1_.zip` containing:
  - `main.tex` (revised 10-slide deck)
  - `SKP-beamer.cls` (custom Silicon Institute of Technology class)
  - `sitlogo.png` (institute logo)
  - `references.bib` (literature references)
  - `README.md` (instructions for Overleaf)
  - `main.pdf` (compiled 10-page reference presentation)
  - `main_original_phase1_backup.tex` (Phase 1 source backup)
  - `main_15slides_dense_backup.tex` (Phase 2 15-slide dense backup)

# PPD-II Second Review Presentation: AI-Powered SOC Assistant

**Title:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Candidate:** Kunal Sanga (Registration No: `2301341031`)  
**Department:** Department of Computer Science & Engineering, Silicon Institute of Technology, Sambalpur  
**Project Guide:** Miss Alka Dash (Assistant Professor, Department of CSE)  
**Academic Review:** PPD-II Second Review (Session 2026–2027)  

---

## 1. Files in this Directory

- `main.tex`: The complete, standalone LaTeX Beamer source code (12 slides, 16:9 widescreen, custom cybersecurity palette).
- `sitlogo.png`: Official high-resolution institute logo embedded in title and header banners.
- `references.bib`: Academic bibliography covering RAG foundations (Lewis et al.), MITRE ATT&CK v14, NIST NVD, and Qwen technical reports.
- `SKP-beamer.cls`: Silicon Institute of Technology custom Beamer class reference file.
- `README.md`: Compilation guide, slide outline, and verified evidence mapping.

---

## 2. Mandatory Department Review Requirements Mapping

| Department Requirement | Slides | Key Content Verified from Implementation |
|---|---|---|
| **System/Design Development** | Slides 3 & 4 | Native TikZ high-level architecture diagram; 6-stage end-to-end data flow (Wazuh $\to$ Normalizer $\to$ PostgreSQL $\to$ Qdrant $\to$ Ollama $\to$ Validator $\to$ React UI). |
| **Technical Approach** | Slides 5 & 6 | Rationale for FastAPI, PostgreSQL, Qdrant, MiniLM-L6-v2, and local Qwen3-8B; Controlled 3-mode evaluation methodology (`llm_only` vs. `standard_rag` vs. `evidence_aware`). |
| **Implementation Progress** | Slides 7, 8, & 9 | 6 completed UI modules (Dashboard, Alerts, AI Analysis, Entity Graph, Waterfall Trace); 1,762 indexed knowledge chunks; **221 passed backend unit tests** and **32 passed frontend unit tests**. |
| **Preliminary Results** | Slide 10 | Benchmark run status on Dataset v2 (12 scenarios completed, 36 evaluations); 100% valid citation rate; Dataset v1 baseline (Recall@1 = 1.000 vs. 0.250 for standard RAG). |

---

## 3. How to Compile

### Option A: Overleaf (Recommended — Fast & Zero-Config)

1. Log in to [Overleaf](https://www.overleaf.com/).
2. Click **New Project** $\to$ **Upload Project** (or create a blank project).
3. Upload the following files into the project root:
   - `main.tex`
   - `sitlogo.png`
   - `references.bib`
4. Set the compiler to **pdfLaTeX** (Project Settings $\to$ Compiler: `pdfLaTeX`).
5. Click **Recompile** to produce the final PDF presentation.

### Option B: Local Compilation with MiKTeX

Open PowerShell or command prompt in this directory and run:

```powershell
pdflatex -synctex=1 -interaction=nonstopmode main.tex
pdflatex -synctex=1 -interaction=nonstopmode main.tex
```

*(Running `pdflatex` twice ensures all Beamer total-frame numbers and cross-references resolve properly).*

---

## 4. Slide-by-Slide Overview

1. **Slide 1 — Title Slide**: Project metadata, student details, guide information, review classification, and institute crest.
2. **Slide 2 — Problem Statement & Objectives**: Alert fatigue, manual IoC cross-referencing, naive LLM hallucination risks, and project scope.
3. **Slide 3 — System/Design Development (Architecture)**: Original native TikZ vector architecture with honest labels (Wazuh JWT client / mock telemetry).
4. **Slide 4 — System/Design Development (Workflow)**: 6-stage operational pipeline from telemetry ingestion to evidence citation validation.
5. **Slide 5 — Technical Approach (Stack & Decisions)**: Component selection matrix comparing FastAPI, PostgreSQL, Qdrant, MiniLM-L6-v2, and Ollama Qwen3-8B.
6. **Slide 6 — Technical Approach (Evaluation Design)**: Controlled tri-evaluation protocol comparing baseline, standard RAG, and evidence-aware RAG across 40 scenarios.
7. **Slide 7 — Implementation Progress (Frontend)**: Real UI capabilities including the force-directed Entity Graph, Waterfall execution traces, and alert console.
8. **Slide 8 — Implementation Progress (Backend & Integration)**: PostgreSQL schema, 1,762 indexed Qdrant chunks (MITRE + NVD), and Docker Compose orchestration.
9. **Slide 9 — Implementation Progress (Software Validation)**: Rigorous test audit: 221 passing backend tests (Pytest) and 32 passing frontend tests (Vitest).
10. **Slide 10 — Preliminary Results**: Verified empirical metrics from benchmark run `20261024-145621-1345d6` (12 completed cases, 36 evaluations) and v1 retrieval ablation.
11. **Slide 11 — Limitations & Future Work**: Transparent discussion of synthetic datasets, mock telemetry, local inference latency, and the 4-phase development roadmap.
12. **Slide 12 — Conclusion & Q&A**: Summary of research contributions, review requirements completion, and closing discussion slide.

---

## 5. Research Honesty & Integrity Safeguards

- **No Fabricated Scores**: The benchmark is reported as **in progress** (36 of 120 evaluations completed). Only verified measurements from `results_partial.json` are reported.
- **Wazuh Status Clarification**: Explicitly identifies the JWT authentication client as implemented while acknowledging live cluster telemetry testing is pending.
- **Testing vs. Detection Separation**: The 100% software test pass rate (253 total automated tests) is clearly distinguished from threat detection accuracy.

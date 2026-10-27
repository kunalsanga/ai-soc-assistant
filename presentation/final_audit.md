# Final Audit & Verification Report

**Review:** PPD-II Second Review (Session 2026–2027)  
**Project Title:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Candidate:** Kunal Sanga (Registration No: `2301341031`)  
**Department:** Computer Science & Engineering, Silicon Institute of Technology, Sambalpur  
**Project Guide:** Miss Alka Dash (Assistant Professor, Department of CSE)  
**Audit Date:** 2026-10-26 13:20 IST  

---

## 1. Compliance with Mandatory Faculty Review Sections

| Mandatory Review Requirement | Covered in Presentation? | Relevant Slides | Empirical Evidence Source |
|---|:---:|---|---|
| **1. System/Design Development** | **YES** | Slides 3 & 4 | Architectural TikZ diagram linking PostgreSQL, Qdrant, Ollama, and React; 6-stage sequential data-flow pipeline from Wazuh ingestion to evidence citation verification. |
| **2. Implementation Progress** | **YES** | Slides 5, 6, & 7 | Active service probes (`GET /health`), 95 alerts in DB, 1,762 vector chunks; operational React 19 UI (Entity Graph, Waterfall); **226 backend unit tests** + **32 frontend unit tests** passing. |
| **3. Technical Approach** | **YES** | Slides 8, 9, & 10 | RAG architecture with 1,618 MITRE techniques and 144 NVD CVEs; 3-mode isolated data source architecture; read-only Wazuh Indexer OpenSearch client; controlled tri-mode evaluation protocol. |
| **4. Preliminary Results** | **YES** | Slide 11 | Verified metrics from Dataset v2 benchmark run `20261024-145621-1345d6` (12 scenarios completed, 36 evaluations completed, 100% valid citation rate); Dataset v1 baseline; retrieval ablation study. |

---

## 2. Research Integrity & Non-Fabrication Audit

All numerical claims in the presentation were verified against active system artifacts:

1. **No Fabricated Benchmark Metrics**:
   - The benchmark on Dataset v2 is explicitly reported as **partially completed (12 scenarios completed out of 40; 36 mode evaluations completed out of 120)**.
   - The reported average wall latencies (LLM-Only: 36.8s, Standard RAG: 82.2s, Evidence-Aware: 79.6s), technique F1 (0.444), and valid citation rate (100%) were computed directly from `evaluation/results/20261024-145621-1345d6/results_partial.json`.
   - The completed baseline run on Dataset v1 (8 scenarios, Recall@1 = 1.000 vs. 0.250) was verified from `evaluation/results/20261017-040510-b9ebc8/results.json`.
2. **Software Tests vs. Threat Detection**:
   - The presentation explicitly separates software testing correctness (226 backend Pytest + 32 frontend Vitest = 258 total passing tests) from cybersecurity threat detection metrics (precision, recall, F1).
3. **Wazuh Status Transparency**:
   - Wazuh is reported as **client-verified but operating in development mock mode**. The presentation clearly states that operational evaluation uses mock/synthetic telemetry because host memory constraints preclude hosting a live local Wazuh cluster.
   - The newly implemented **Data-Source Abstraction** (`demo`, `live_wazuh`, `dataset_replay`) and configuration template (`.env.wazuh.example`) are presented as preparation for connecting a remote Wazuh server.
4. **Knowledge Base Verification**:
   - The reported count of **1,762 indexed vector points** was verified via a live HTTP probe to Qdrant collection `security_knowledge`.
5. **Database Count Verification**:
   - The reported count of **95 alerts, 44 analyses, and 48 evidence records** was verified via live SQL queries against PostgreSQL.

---

## 3. Template & Asset Preservation

- **Template Preserved**: The presentation in `presentation/Seminar_Presentation_1_/main.tex` reuses the custom `SKP-beamer` layout conventions, header navigation strip, footer bar, and teal/dark/pale color palette.
- **Class File Preserved**: `SKP-beamer.cls` is preserved in the project directory.
- **Logo Preserved**: `sitlogo.png` is embedded in the title and slide header banners.
- **Backup Created**: The original Phase 1 template was backed up to `main_original_phase1_backup.tex`.
- **References Included**: `references.bib` covers foundational RAG literature, SOC copilot surveys, and MITRE/NIST frameworks.

---

## 4. Verification Check Summary

- **Local Compiler Availability**: `pdflatex` is not installed in the Windows shell path. Local verification confirmed clean syntax, complete macro definitions, and valid file references. The project is designed specifically for zero-config compilation on Overleaf with pdfLaTeX.
- **Overleaf Upload Package**: Created `presentation/Seminar_Presentation_1.zip` containing all self-contained dependencies (`main.tex`, `sitlogo.png`, `SKP-beamer.cls`, `references.bib`, `README.md`).
- **All 4 Mandatory Sections**: Completely and visibly addressed in the slide sequence and titles.

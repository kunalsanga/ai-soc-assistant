# PPD-II Second Review Presentation Guide

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Candidate:** Kunal Sanga (Registration No: `2301341031`)  
**Department:** Department of Computer Science & Engineering, Silicon Institute of Technology, Sambalpur  
**Project Guide:** Miss Alka Dash (Assistant Professor, Department of CSE)  
**Academic Stage:** PPD-II Second Review (Session 2026–2027)  

---

## 1. Presentation Structure & Faculty Requirements Mapping

The presentation in `presentation/Seminar_Presentation_1_/` has been crafted to adhere to the four mandatory faculty sections:

| Mandatory Faculty Section | Slide Numbers | Key Verified Deliverables Presented |
|---|---|---|
| **System/Design Development** | Slides 3 & 4 | Multi-tier architecture diagram (PostgreSQL, Qdrant, Ollama `qwen3:8b`, React 19 UI); 6-stage sequential data-flow pipeline from Wazuh ingestion to evidence citation verification. |
| **Implementation Progress** | Slides 5, 6, & 7 | Backend services & live probe verification (`dependencies_ok: true`, 1,762 vector points); operational UI modules (Obsidian Entity Graph, Execution Waterfall); **226 passed backend Pytest unit tests** and **32 passed frontend Vitest unit tests**. |
| **Technical Approach** | Slides 8, 9, & 10 | Evidence-grounded RAG design (1,618 MITRE ATT&CK chunks + 144 NVD CVEs); 3-mode isolated data-source architecture (`demo`, `live_wazuh`, `dataset_replay`); read-only Wazuh Indexer OpenSearch client; controlled tri-mode evaluation protocol. |
| **Preliminary Results** | Slide 11 | Transparent status of Dataset v2 benchmark run (`20261024-145621-1345d6`: 12 scenarios completed, 36 evaluations completed, 100% valid citation rate); Dataset v1 retrieval baseline (Recall@1 = 1.000 vs. 0.250); retrieval ablation study. |

---

## 2. Files in this Directory

- `main.tex`: The complete, 15-slide LaTeX Beamer presentation using the institutional visual identity, colors, and layout macros.
- `SKP-beamer.cls`: Preserved custom Silicon Institute of Technology class file.
- `sitlogo.png`: Official institute logo embedded in header banners and title slide.
- `references.bib`: Academic references including foundational literature on RAG, SOC copilot surveys, and MITRE/NIST frameworks.
- `main_original_phase1_backup.tex`: Exact backup of the original Phase 1 template presentation.

---

## 3. How to Compile & Upload to Overleaf

### Method 1: Overleaf (Zero-Configuration, Recommended)

1. Open your browser and navigate to [Overleaf](https://www.overleaf.com/).
2. Click **New Project** $\to$ **Upload Project**.
3. Upload the `presentation/Seminar_Presentation_1.zip` archive (or drag and drop the folder contents: `main.tex`, `sitlogo.png`, `SKP-beamer.cls`, `references.bib`).
4. Ensure the Overleaf compiler is set to **pdfLaTeX** (default):
   - Menu (top left) $\to$ Settings $\to$ Compiler $\to$ **pdfLaTeX**.
5. Click **Recompile**. The complete 15-slide PDF will generate without warnings or missing assets.

### Method 2: Local MiKTeX / TeX Live Compilation

Open PowerShell in `presentation/Seminar_Presentation_1_/` and run:

```powershell
pdflatex -synctex=1 -interaction=nonstopmode main.tex
pdflatex -synctex=1 -interaction=nonstopmode main.tex
```
*(Running twice ensures slide numbers and cross-references resolve correctly).*

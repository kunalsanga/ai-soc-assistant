# Final Visualization & Rebuild Synthesis Report

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review  
**Author:** Senior Research Data Scientist & Academic Visualizations Specialist  
**Execution Date:** November 10, 2026  
**Artifact Directory:** `docs/third_review/milestone_3/final_visualizations/`  

---

## 1. Scope & Purpose of Rebuild

This rebuild represents a rigorous, research-grade overhaul of all experimental visualizations and statistical reporting for the PPD-II Third Review. Every plotted number, error bar, percentage, and confusion count was derived directly from the authoritative benchmark files:
- `backend/evaluation/results/20261109-185423-0f4cfd/results.json` ($120$ end-to-end evaluation records)
- `backend/evaluation/results/20261109-185423-0f4cfd/ablation.json` ($120$ retrieval ranking records)
- `backend/evaluation/dataset_v2.json` ($40$ curated scenario specifications)

No values were manually entered, approximated, or cosmetically smoothed.

---

## 2. Complete Deliverables Manifest

### 2.1 Scientific Figures Generated (`final_visualizations/figures/`)
| Figure Identifier | Format | Dimensions | Purpose & Core Content |
|---|:---:|:---:|---|
| `figure1_classification.png` & `.svg` | 300 DPI / Vector | 8.5" $\times$ 4.6" | Grouped horizontal bar chart of Macro/Micro F1, Precision, and Recall across the 3 modes. |
| `figure1_confusion_counts.png` & `.svg` | 300 DPI / Vector | 7.5" $\times$ 4.2" | Pooled TP, FP, and FN event counts across 36 attack scenarios (54 expected techniques). |
| `figure2_retrieval_ablation.png` & `.svg` | 300 DPI / Vector | 8.5" $\times$ 4.8" | Retrieval quality ablation comparing Recall@1, Recall@5, and MRR over 1,762 vector chunks. |
| `figure2_recall_at_1.png` & `.svg` | 300 DPI / Vector | 7.5" $\times$ 4.4" | Highlighting the **+67.5 percentage-point leap** in Top-1 retrieval; Token Hashing labeled as offline baseline. |
| `figure3_end_to_end_latency.png` & `.svg` | 300 DPI / Vector | 8.0" $\times$ 4.6" | End-to-end triage wall latency in seconds (mean, sample std dev error bars, median, and raw jittered scatter points). |
| `figure4_retrieval_latency.png` & `.svg` | 300 DPI / Vector | 8.0" $\times$ 4.4" | Sub-second knowledge retrieval latency in milliseconds ($38.9\text{--}240.2\text{ ms}$, $<0.5\%$ of pipeline). |
| `figure5_scenario_heatmap.png` & `.svg` | 300 DPI / Vector | 9.0" $\times$ 11.0" | Per-scenario technique F1 matrix for all 40 cases, with benign negative controls visually separated and outliers annotated. |
| `figure6_benign_controls.png` & `.svg` | 300 DPI / Vector | 9.0" $\times$ 4.4" | Detailed comparative evaluation matrix of the 4 benign negative control scenarios ($75.0\%$ accuracy). |
| `figure7_cve_grounding.png` & `.svg` | 300 DPI / Vector | 8.5" $\times$ 4.4" | Active exploit Log4Shell case study (`CVE-2021-44228`), demonstrating 1.0 vs 0.0 F1 grounding contrast. |
| `architecture_diagram.png` & `.svg` | 300 DPI / Vector | 11.5" $\times$ 5.0" | Large, clean 4-tier vector system architecture diagram of the fully sovereign, on-premise pipeline. |

### 2.2 IEEE/ACM Publication Tables (`final_visualizations/tables/`)
- `classification_results.tex`: End-to-end MITRE ATT&CK technique triage results with pooled confusion counts.
- `retrieval_ablation.tex`: 40-scenario isolated retrieval ablation over 1,762 indexed chunks.
- `latency_results.tex`: Stage timing breakdown separating millisecond retrieval from multi-second triage.
- `benign_controls.tex`: Detailed per-scenario evaluation of the 4 benign negative controls.
- `cve_case_study.tex`: Vulnerability grounding performance on `CVE-2021-44228` and 100% True-Negative abstention.

### 2.3 Documentation & Scripts
- `DATA_VERIFICATION_REPORT.md`: Comprehensive audit report verifying all raw counts, schemas, and metrics.
- `FIGURE_CATALOG.md`: Complete metadata catalog of all 10 visual artifacts with descriptions and captions.
- `generate_final_visualizations.py`: Standalone reproducible Python script to regenerate all figures from raw JSONs.

---

## 3. Key Scientific Conclusions for Faculty Presentation

1. **Classification Reality:**  
   LLM-Only achieves the highest Macro F1 (**0.9028**) on this benchmark compared to Standard RAG (**0.8750**) and Evidence-Aware RAG (**0.8611**). On 34 of 36 attack scenarios, LLM-Only and Evidence-Aware predictions are identical. The difference is attributable to two specific edge cases: Case 20 (context distractor effect causing 2 FPs) and Case 24 (formatting glitch triggering safe fallback).
2. **Retrieval Contribution:**  
   Entity anchoring delivers an extraordinary **+67.5 percentage-point leap in Recall@1** (from 22.5% to 90.0%) and elevates MRR from 0.2742 to 0.9125, proving that unstructured security logs require entity-scoped retrieval to avoid semantic drift.
3. **Domain Grounding & Auditability:**  
   While raw LLMs can memorize generic attack patterns, external RAG is strictly required for specific CVE identification (Log4Shell F1 = 1.0 vs 0.0) and guarantees auditability through a **97.3% citation veracity rate** with zero invented reference IDs.
4. **Latency Realism:**  
   Knowledge retrieval requires only $240.2\text{ ms}$ ($<0.5\%$ of wall time), whereas local 8B LLM generation requires $\sim 50\text{ seconds}$, which is completely viable for asynchronous Tier-1 triage.


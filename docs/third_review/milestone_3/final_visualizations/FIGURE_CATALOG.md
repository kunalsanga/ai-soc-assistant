# Figure Catalog: Research-Grade Scientific Visualizations

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Milestone:** PPD-II Third Review  
**Directory:** `docs/third_review/milestone_3/final_visualizations/figures/`  
**Formats:** 300 DPI High-Resolution PNG & Vector SVG  

---

## Catalog of Scientific Visualizations

### 1. `figure1_classification.png` / `.svg`
- **Title:** MITRE ATT&CK Technique Classification Performance Across Modes
- **Type:** Grouped Horizontal Bar Chart
- **Dimensions:** 8.5" $\times$ 4.6" (300 DPI)
- **Metrics Plotted:** Macro F1, Micro F1, Macro Precision, Macro Recall across 36 attack scenarios.
- **Plotted Values:**
  - LLM-Only: Macro F1 = **0.9028**, Micro F1 = **0.8889**, Precision = **0.9861**, Recall = **0.8611**
  - Standard RAG: Macro F1 = **0.8750**, Micro F1 = **0.8776**, Precision = **0.9583**, Recall = **0.8333**
  - Evidence-Aware RAG: Macro F1 = **0.8611**, Micro F1 = **0.8600**, Precision = **0.9398**, Recall = **0.8333**
- **Scientific Caption:** Demonstrates end-to-end technique classification on 36 realistic attack scenarios. Zero-shot LLM performs best on overall technique F1 due to 2 specific RAG edge cases (Case 20 context distraction & Case 24 JSON syntax error). On 34 of 36 attack scenarios, predictions are identical.

---

### 2. `figure1_confusion_counts.png` / `.svg`
- **Title:** MITRE ATT&CK Classification Event Breakdown (Pooled Confusion Counts)
- **Type:** Grouped Vertical Bar Chart
- **Dimensions:** 7.5" $\times$ 4.2" (300 DPI)
- **Metrics Plotted:** True Positives (TP), False Positives (FP), False Negatives (FN) across 36 attack scenarios (54 total expected techniques).
- **Plotted Values:**
  - LLM-Only: 44 TP, 1 FP, 10 FN
  - Standard RAG: 43 TP, 1 FP, 11 FN
  - Evidence-Aware RAG: 43 TP, 3 FP, 11 FN
- **Scientific Caption:** Event counts pooled across multi-label technique set predictions. Evidence-Aware RAG generated 2 extra FPs in Case 20 because retrieved ATT&CK text mentioned related technique T1036 and deprecated T1050.

---

### 3. `figure2_retrieval_ablation.png` / `.svg`
- **Title:** Security Knowledge Retrieval Ablation Study
- **Type:** Grouped Vertical Bar Chart
- **Dimensions:** 8.5" $\times$ 4.8" (300 DPI)
- **Metrics Plotted:** Recall@1, Recall@5, MRR across 40 scenarios over 1,762 indexed chunks.
- **Plotted Values:**
  - Standard RAG (Dense Unanchored): Recall@1 = **0.2250** (9/40), Recall@5 = **0.4000** (16/40), MRR = **0.2742**
  - Evidence-Aware RAG (Entity-Anchored): Recall@1 = **0.9000** (36/40), Recall@5 = **0.9250** (37/40), MRR = **0.9125**
  - Token Hashing (Offline Lexical Baseline): Recall@1 = **0.9250** (37/40), Recall@5 = **0.9250** (37/40), MRR = **0.9250**
- **Scientific Caption:** Evaluates pure retrieval quality without LLM confounding. Entity anchoring resolves semantic drift in unstructured logs, boosting Recall@1 by **+67.5 percentage points** over dense search.

---

### 4. `figure2_recall_at_1.png` / `.svg`
- **Title:** Breakthrough in Top-1 Threat Knowledge Retrieval
- **Type:** Focused Comparative Bar Chart with Highlight Annotation
- **Dimensions:** 7.5" $\times$ 4.4" (300 DPI)
- **Plotted Values:** Standard RAG = **22.5%** (9/40), Evidence-Aware RAG = **90.0%** (36/40), Token Hashing = **92.5%** (37/40).
- **Highlight:** Clear connecting arrow and callout badge indicating `+67.5 percentage points` improvement. Token Hashing clearly labeled as `Offline lexical retrieval baseline — no LLM`.

---

### 5. `figure3_end_to_end_latency.png` / `.svg`
- **Title:** End-to-End Triage Wall Latency by Analysis Mode
- **Type:** Bar Chart with Standard Deviation Error Bars & Raw Scenario Scatter Points
- **Dimensions:** 8.0" $\times$ 4.6" (300 DPI)
- **Plotted Values (Seconds, $N = 40$ per mode):**
  - LLM-Only: Mean = **24.0s** $\pm$ **2.4s**, Median = **23.9s**, Min = 19.3s, Max = 29.6s
  - Standard RAG: Mean = **51.6s** $\pm$ **7.9s**, Median = **50.7s**, Min = 32.8s, Max = 77.2s
  - Evidence-Aware RAG: Mean = **50.5s** $\pm$ **13.1s**, Median = **48.3s**, Min = 26.1s, Max = 92.7s
- **Scientific Caption:** Error bars represent empirical sample standard deviation ($ddof = 1$) from the 40 raw runs. Jittered scatter points show individual scenario execution times. Local Ollama Qwen3:8B token generation on host hardware accounts for 99.5% of latency.

---

### 6. `figure4_retrieval_latency.png` / `.svg`
- **Title:** Knowledge Retrieval Search Latency (Sub-Second Vector Matching)
- **Type:** Horizontal Bar Chart
- **Dimensions:** 8.0" $\times$ 4.4" (300 DPI)
- **Plotted Values (Milliseconds, $N = 40$ per method):**
  - Token Hashing: **38.9 ms** ($38.85\text{ ms}$)
  - Standard RAG: **51.5 ms** ($51.47\text{ ms}$)
  - Evidence-Aware RAG: **240.2 ms** ($240.17\text{ ms}$)
- **Scientific Caption:** Vector search operates in sub-second regimes, consuming $<0.5\%$ of total triage pipeline wall time. Evidence-Aware executes observable extraction, payload filtering, and vector scoring within 240.2 ms.

---

### 7. `figure5_scenario_heatmap.png` / `.svg`
- **Title:** Per-Scenario Evaluation Heatmap (40 Scenarios $\times$ 3 Modes = 120 Runs)
- **Type:** High-Resolution Matrix Heatmap with Callout Annotations
- **Dimensions:** 9.0" $\times$ 11.0" (300 DPI)
- **Structure:**
  - Rows 1–36: 36 Attack Scenarios displaying exact technique F1 (0.00 – 1.00).
  - Rows 37–40: 4 Benign Negative Controls separated by a red boundary line, displaying PASS/FAIL severity moderation status.
  - Outlier callouts explicitly highlighting: Case 11 (Standard RAG miss), Case 20 (Evidence-Aware distractor), and Case 24 (Evidence-Aware JSON glitch).

---

### 8. `figure6_benign_controls.png` / `.svg`
- **Title:** Benign Negative-Control Evaluation ($N = 4$ Scenarios)
- **Type:** Structured Comparative Evaluation Matrix
- **Dimensions:** 9.0" $\times$ 4.4" (300 DPI)
- **Content:** Compares observed telemetry, expected severity band (Low), and predicted severity band across all three modes for Nessus Scan, Backup Rsync, Git SSH Clone, and PowerShell Update.
- **Scientific Caption:** All modes achieve 75.0% accuracy ($3/4$). Highlights the operational contrast: RAG moderates Nessus scanning to prevent false alarms, while elevating PowerShell updates due to defensive script execution bias.

---

### 9. `figure7_cve_grounding.png` / `.svg`
- **Title:** Vulnerability Grounding Case Study: Apache Log4Shell Exploitation
- **Type:** Comparative Bar Chart with Scenario Context Callouts
- **Dimensions:** 8.5" $\times$ 4.4" (300 DPI)
- **Plotted Values:**
  - Ground Truth: `CVE-2021-44228`
  - LLM-Only: Missed (F1 = **0.00**, predicted `[]`)
  - Standard RAG: Grounded (F1 = **1.00**, retrieved Chunk 1682)
  - Evidence-Aware RAG: Grounded (F1 = **1.00**, retrieved Chunk 1682)
- **Scientific Caption:** Demonstrates that external RAG is strictly necessary for specific CVE attribution. 39 non-CVE scenarios achieved 100% true-negative abstention across all modes.

---

### 10. `architecture_diagram.png` / `.svg`
- **Title:** AI-Powered SOC Assistant: Sovereign System Architecture & Telemetry Pipeline
- **Type:** 4-Tier High-Resolution Vector Block Diagram
- **Dimensions:** 11.5" $\times$ 5.0" (300 DPI)
- **Tiers Depicted:**
  1. Ingestion & Data: Wazuh SIEM JSON, Syslog, FastAPI Async Ingest, PostgreSQL 15, migration `c01_datasource`.
  2. Knowledge Retrieval: Qdrant Vector Container, 1,762 indexed chunks, `all-MiniLM-L6-v2`, entity-anchored dual filter.
  3. Local AI Engine: Sovereign Ollama service, Qwen3:8B, temperature 0.0, citation verification engine (97.3% valid).
  4. Analyst Console: React 19 + TypeScript, SSE streaming, interactive entity graph, human-in-the-loop authority.


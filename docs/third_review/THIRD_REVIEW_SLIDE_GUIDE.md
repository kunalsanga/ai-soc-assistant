# PPD-II Third Review: Slide-by-Slide Presentation Guide & Talking Points

**Project:** AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models  
**Review Target:** PPD-II Third Review (Implementation, Benchmark Results, Analysis & Technical Contributions)  
**Academic Session:** 2026–2027  
**Department:** Computer Science & Engineering, Silicon Institute of Technology, Sambalpur  
**Presentation Deck:** `presentation/Seminar_Presentation_1_/main.pdf` (19 Slides)  
**Source Code:** `presentation/Seminar_Presentation_1_/main.tex`  

---

## Strategic Presentation Mindset for Faculty Evaluation

> [!IMPORTANT]
> **Core Research Narrative for the Committee:**  
> The third review is about scientific honesty, experimental rigor, and defensible technical contributions.
> - **DO NOT claim** that Evidence-Aware RAG outperformed LLM-Only on overall MITRE classification F1 (LLM-Only scored **0.9028** vs. **0.8611** for Evidence-Aware).
> - **EMPHASIZE your true breakthrough:** Entity-Anchored Retrieval delivers an astonishing **+67.5 percentage-point leap in Recall@1** (90.0% vs. 22.5%) over conventional dense vector search, completely solving semantic drift in noisy security logs.
> - **HIGHLIGHT domain indispensability:** Parametric LLMs fail completely on specific CVEs (Log4Shell F1 = 0.0), whereas RAG grounds them perfectly (F1 = 1.0). RAG provides **97.3% citation veracity** and audit-ready explainability that prevents hallucinations in production.

---

## Slide-by-Slide Breakdown & Speaker Scripts

```
SLIDE DIRECTORY (19 SLIDES):
01. Title Slide (Silicon Template Identity)
02. Problem Statement & Operational Motivation
03. Project Objectives & Architectural Scope
04. System Architecture & Sovereign Stack (Chart 5)
05. Implementation Completion: Review 3 Status
06. Tri-Mode Investigation Paradigm
07. Technical Innovation: Entity-Anchored Retrieval
08. Dataset v2 Experimental Methodology
09. MITRE ATT&CK Classification Results (Chart 1)
10. Retrieval Ablation Results (Chart 2)
11. Pipeline Latency Breakdown: Search vs. Triage (Chart 3)
12. Scenario Category Performance Heatmap (Chart 4)
13. CVE Grounding: Log4Shell Case Study
14. Benign Negative Controls & Citation Veracity
15. Failure Analysis: Explaining the F1 Gap (Cases 20 & 24)
16. Testing, Quality Assurance & Data Integrity
17. Technical Contributions & Research Innovations
18. Implementation Status & Roadmap to Defense
19. Conclusion & Defense Q&A
```

---

### Slide 1: Title Slide
- **Visuals:** Silicon Institute of Technology branding, academic session 2026–2027, guide & student details.
- **Talking Points:**
  - *"Good morning respected members of the evaluation committee and our supervisor Miss Alka Dash. Today, we present the Third Review of our project: 'AI-Powered Security Operations Center (SOC) Assistant Using Large Language Models'."*
  - *"In this review, we demonstrate full system completion, an independently audited 120-run benchmark across 40 enterprise scenarios, an empirical retrieval ablation study, and concrete technical innovations in sovereign, citation-grounded security triage."*

---

### Slide 2: Problem Statement & Motivation
- **Visuals:** Split comparison cards: *The Triage Crisis in Modern SOCs* vs. *Risks of Naive Cloud AI*.
- **Talking Points:**
  - *"Modern enterprise SOCs face severe alert inundation. Tier-1 analysts routinely process over 1,000 alerts daily. Up to 40% are closed without deep investigation due to cognitive fatigue, leading to prolonged adversary dwell times."*
  - *"While AI offers a solution, commercial cloud LLMs introduce two critical barriers: first, sending proprietary network hostnames, IP addresses, and user logs violates compliance frameworks like SOC2 and GDPR. Second, naive generative AI is prone to hallucinations—inventing plausible CVEs or misattributing attack tactics without proof."*
  - *"This defines our goal: a sovereign, on-premise AI assistant that operates with zero cloud data egress and grounds every recommendation in verifiable security catalogs."*

---

### Slide 3: Project Objectives
- **Visuals:** 4 core pillars: Advisory Triage, Grounded Reasoning, Sovereign Execution, and Citation Verification.
- **Talking Points:**
  - *"Our project delivers four specific objectives: First, autonomous advisory triage that translates cryptic SIEM logs into structured, plain-English summaries and containment playbooks."*
  - *"Second, knowledge grounding: every hypothesis is mapped to the MITRE ATT&CK Enterprise Matrix and NVD CVE catalogs."*
  - *"Third, local sovereign execution using open-weights models (Qwen3:8B via Ollama) and local vector indexing (Qdrant), ensuring raw telemetry never leaves the enterprise boundary."*
  - *"Fourth, human-in-the-loop auditability: the system is an advisory copilot; final containment decisions remain with the human operator."*

---

### Slide 4: System Architecture & Technology Stack
- **Visuals:** [`figures/chart5_technical_architecture.png`](file:///c:/Users/kunal%20sanga/OneDrive/Code%20files/PPD2/soc-assistant/presentation/Seminar_Presentation_1_/figures/chart5_technical_architecture.png) + 3 component cards.
- **Talking Points:**
  - *"Here is the four-tier system architecture we have built and deployed on host hardware."*
  - *"1. Ingestion Layer: A FastAPI asynchronous backend ingests raw alerts from Wazuh SIEM or Syslog, normalizes entities, and writes to PostgreSQL with Alembic schema versioning."*
  - *"2. Knowledge Layer: A dedicated Qdrant vector database container pre-indexed with 1,762 chunks—1,618 MITRE ATT&CK techniques and 144 NVD CVEs embedded via local `all-MiniLM-L6-v2`."*
  - *"3. Reasoning Layer: An on-premise Ollama instance hosting Qwen3:8B at temperature 0.0, paired with an automated citation validation engine."*
  - *"4. Analyst Console: A React 19 and TypeScript single-page application featuring live Server-Sent Events (SSE) streaming and interactive entity graph exploration."*

---

### Slide 5: Implementation Completion: Third Review Status
- **Visuals:** Structured delivery checklist across Backend, Knowledge, Frontend, and Quality Assurance.
- **Talking Points:**
  - *"All planned architectural components are fully implemented and running locally. The backend exposes 21 REST and SSE endpoints. PostgreSQL is migrated to revision `c01_datasource`, establishing strict data isolation between Demo alerts, Live Wazuh ingestion, and Replay datasets."*
  - *"The React 19 frontend provides 10 operational views. Furthermore, we built an automated evaluation harness with SQLite/JSON persistence and checkpoint recovery."*
  - *"The system is backed by 258 automated software unit and integration tests passing with zero failures."*

---

### Slide 6: Tri-Mode Investigation Paradigm
- **Visuals:** 3 comparative workflow cards: LLM-Only, Standard RAG, Evidence-Aware RAG.
- **Talking Points:**
  - *"To scientifically evaluate how AI behaves in SOC environments, we engineered and benchmarked three distinct operational paradigms under strictly identical inputs:"*
  - *"1. Mode 1: LLM-Only (Zero-Shot Baseline): The raw alert is passed directly to Qwen3:8B with zero retrieved context, testing pure parametric memorization."*
  - *"2. Mode 2: Standard RAG (Dense Vector Search): The alert string is embedded and searched against Qdrant using unanchored cosine similarity; the top-5 nearest chunks are injected into the LLM context."*
  - *"3. Mode 3: Evidence-Aware RAG (Our Contribution): The system parses structured entities (IPs, process paths, users, rule tags), executes an entity-anchored dual query with exact payload filters, and enforces reference-ID validation before saving."*

---

### Slide 7: Technical Innovation: Entity-Anchored Retrieval
- **Visuals:** The Flaw in Standard RAG vs. Our Entity-Anchored Solution.
- **Talking Points:**
  - *"Why is standard dense RAG inadequate for cybersecurity? Security logs are dominated by generic, repetitive keywords—such as 'failed', 'connection', 'sshd', 'authentication', 'port 22'. When encoded into dense vector space, the vector captures the generic syntax of the log rather than the adversary's actual behavioral intent. This causes severe semantic drift, dropping the true threat chunk far down the ranking."*
  - *"Our innovation—Entity-Anchored Dual Retrieval—extracts operational observables and Wazuh rule tags (`rule.mitre.id`), and generates a hybrid filtered query in Qdrant. This ensures candidate chunks are pre-scoped to the true tactic domain before ranking, catapulting the ground-truth threat chunk directly to Rank 1."*

---

### Slide 8: Dataset v2 Experimental Methodology
- **Visuals:** Dataset v2 Composition & Execution Protocol.
- **Talking Points:**
  - *"To evaluate these modes, we curated Dataset v2, consisting of 40 non-overlapping enterprise scenarios: 36 realistic attack scenarios spanning 9 MITRE ATT&CK tactics, plus 4 benign negative control scenarios representing routine sysadmin activities."*
  - *"Execution protocol: 40 scenarios $\times$ 3 modes = 120 total evaluations executed to 100% completion with zero runtime errors."*
  - *"Data integrity safeguards: Alerts are namespaced with unique IDs (`v2-eval-001` through `v2-eval-040`) to prevent collisions with historical v1 data. Ground truth is isolated during LLM inference, and all runs were executed deterministically at temperature 0.0."*

---

### Slide 9: MITRE ATT&CK Classification Results
- **Visuals:** [`figures/chart1_mitre_classification.png`](file:///c:/Users/kunal%20sanga/OneDrive/Code%20files/PPD2/soc-assistant/presentation/Seminar_Presentation_1_/figures/chart1_mitre_classification.png) (Macro/Micro F1, Precision, Recall, Confusion Matrix).
- **Talking Points:**
  - *"Here are the end-to-end MITRE technique classification results across the 36 attack scenarios:"*
  - *"LLM-Only achieved a Macro F1 of 0.9028 (Micro F1 0.8889, Precision 0.9861, Recall 0.8611) with 44 True Positives, 1 False Positive, and 10 False Negatives."*
  - *"Standard RAG achieved a Macro F1 of 0.8750 (43 TP, 1 FP, 11 FN)."*
  - *"Evidence-Aware RAG achieved a Macro F1 of 0.8611 (43 TP, 3 FP, 11 FN)."*
  - *"Crucial scientific finding: LLM-Only achieved the highest raw classification F1 on this dataset. Evidence-Aware RAG performed identically on 34 out of 36 attack cases. Its value proposition is not artificial classification uplift, but verifiable grounding, domain explainability, and CVE attribution."*

---

### Slide 10: Retrieval Ablation Results
- **Visuals:** [`figures/chart2_retrieval_ablation.png`](file:///c:/Users/kunal%20sanga/OneDrive/Code%20files/PPD2/soc-assistant/presentation/Seminar_Presentation_1_/figures/chart2_retrieval_ablation.png) (Recall@1, Recall@5, MRR, Latency).
- **Talking Points:**
  - *"To measure our retrieval innovation independently of LLM generation noise, we performed an isolated 40-scenario ablation across our 1,762 vector chunks with no LLM in the loop."*
  - *"The results reveal the core technical contribution of our work: Standard dense RAG achieved only 22.5% Recall@1 (9/40) and an MRR of 0.2742 due to semantic drift."*
  - *"Evidence-Aware Entity Anchoring achieved **90.0% Recall@1** (36/40) and an **MRR of 0.9125**—an extraordinary absolute gain of **+67.5 percentage points**."*
  - *"We also evaluated an offline Token Hashing baseline, which achieved 92.5% Recall@1. We emphasize that Token Hashing is an offline lexical retrieval baseline, not an end-to-end LLM triage mode."*

---

### Slide 11: Pipeline Latency Breakdown: Search vs. Generation
- **Visuals:** [`figures/chart3_latency_analysis.png`](file:///c:/Users/kunal%20sanga/OneDrive/Code%20files/PPD2/soc-assistant/presentation/Seminar_Presentation_1_/figures/chart3_latency_analysis.png) (Search ms vs. Pipeline s).
- **Talking Points:**
  - *"A critical metric distinction must be preserved between retrieval-stage search latency and end-to-end triage latency."*
  - *"Knowledge retrieval operates in milliseconds: Token Hashing requires 38.9 ms, Standard RAG 51.5 ms, and Evidence-Aware RAG 240.2 ms. Retrieval consumes less than 0.5% of total pipeline wall-clock time."*
  - *"In contrast, end-to-end analysis operates in seconds: LLM-Only takes 24.0 s, Standard RAG 51.6 s, and Evidence-Aware RAG 50.5 s. The local 8B model token generation on host hardware accounts for 99.5% of latency. In real SOC operations, ~50 seconds per alert is completely viable for asynchronous Tier-1 queue triage."*

---

### Slide 12: Scenario Category Performance Heatmap
- **Visuals:** [`figures/chart4_scenario_performance_heatmap.png`](file:///c:/Users/kunal%20sanga/OneDrive/Code%20files/PPD2/soc-assistant/presentation/Seminar_Presentation_1_/figures/chart4_scenario_performance_heatmap.png) + Tactical Analysis Card.
- **Talking Points:**
  - *"This heatmap breaks down performance across all 10 categories in Dataset v2 (9 ATT&CK attack tactics plus 1 benign control group)."*
  - *"All three modes achieved a perfect 1.00 F1 across Credential Access, Execution, Impact, Privilege Escalation, and Persistence."*
  - *"The primary tactical challenge occurs in Command & Control (F1 = 0.67) and Defense Evasion (F1 = 0.80), where complex multi-stage attacks present high technique ambiguity (e.g., T1071 vs. T1021)."*
  - *"Row 10 evaluates our 4 Benign Controls, where all three modes achieved 75.0% accuracy in correctly recognizing routine non-malicious operations."*

---

### Slide 13: Grounded CVE Identification: Log4Shell Case Study
- **Visuals:** Enterprise CVE Context vs. Log4Shell (`case-29`) Grounding Results.
- **Talking Points:**
  - *"In enterprise security operations, the vast majority of alerts do not involve specific CVEs—they involve credential misuse, brute force, or living-off-the-land techniques. Accordingly, 39 of our 40 scenarios contain no expected CVE, and all three modes achieved 100% True-Negative abstention."*
  - *"However, on our active exploit scenario—`case-29`, an Apache Log4Shell remote code execution attempt—the difference between parametric LLMs and RAG becomes stark:"*
  - *"LLM-Only completely failed to identify `CVE-2021-44228` (F1 = 0.00), producing generic prose without vulnerability pinning."*
  - *"In contrast, both Standard RAG and Evidence-Aware RAG retrieved NVD chunk 1682 and predicted the exact CVE with **1.00 F1**."*
  - *"Takeaway for the committee: While parametric weights can guess general MITRE tactics, external RAG retrieval is strictly mandatory for authoritative CVE attribution."*

---

### Slide 14: Benign Negative Controls & Citation Veracity
- **Visuals:** Benign Negative Controls ($N=4$) vs. Citation Reference Veracity.
- **Talking Points:**
  - *"We evaluated 4 benign negative controls to test false-alarm resilience:"*
  - *"In `case-37` (authorized Nessus vulnerability scan), LLM-Only escalated the alert to High severity. RAG successfully moderated it to Medium because retrieved scanner documentation provided operational context, preventing an unnecessary alert escalation."*
  - *"In `case-40` (PowerShell module update), defensive security bias caused all modes to maintain elevated caution due to encoded parameters."*
  - *"On citation governance: Evidence-Aware RAG achieved a **97.3% valid reference rate** across 37 grounded evaluations (36/37). In `case-22`, the system actively detected and penalized an invented citation ID (validity 0.0%), proving our validation layer actively flags hallucinations."*
  - *"We qualify that this metric measures reference identifier existence and provenance, not formal semantic entailment of every prose sentence."*

---

### Slide 15: Failure Analysis & Limitations
- **Visuals:** Deep Dive into the 2 Edge Cases: Context Distraction (`case-20`) & JSON Syntax Failure (`case-24`).
- **Talking Points:**
  - *"We conducted a deep audit into why LLM-Only scored a slightly higher F1 (0.9028 vs. 0.8611). On 34 of 36 attack scenarios, LLM-Only and Evidence-Aware RAG produced identical technique predictions. The entire discrepancy boils down to exactly two edge cases:"*
  - *"1. Case 20 (Context Distractor Effect): For a system service creation alert (`T1543.003`), the retrieved ATT&CK chunk also mentioned related technique `T1036` and deprecated technique `T1050`. The 8B LLM over-extrapolated and predicted both, producing 2 False Positives and dropping F1 to 0.50."*
  - *"2. Case 24 (JSON Syntax Failure): Retrieval correctly found `T1021.001`, but Qwen3:8B produced trailing markdown formatting that broke JSON parsing. The safe fallback handler cleanly defaulted to an empty prediction (F1 = 0.00)."*
  - *"Limitation: The benchmark relies on MITRE tags in Wazuh rule XML metadata (`rule.mitre.id`) as operational inputs; zero-tag discovery on raw logs remains an unmeasured future scope."*

---

### Slide 16: Testing, Quality Assurance & Data Integrity
- **Visuals:** 258 Automated Tests + 6 Dedicated Benchmark Integrity Tests.
- **Talking Points:**
  - *"Software quality and data integrity are central to our work."*
  - *"We maintain 258 automated software tests: 226 in Pytest covering normalization, vector retrieval, orchestration, and SIEM connectors; and 32 in Vitest for the React frontend."*
  - *"To ensure benchmark integrity, we authored 6 dedicated regression tests that verify zero alert-ID collisions between v1 and v2, confirm database schema migration `c01_datasource`, and validate idempotent scenario seeding."*
  - *"We distinguish software testing (which confirms code correctness) from benchmark evaluation (which measures threat detection accuracy)."*

---

### Slide 17: Technical Contributions & Innovation
- **Visuals:** 4 Concrete Academic & Engineering Contributions for PPD-II.
- **Talking Points:**
  - *"We summarize four concrete technical contributions for this third review:"*
  - *"1. Formulated and resolved the semantic drift failure of dense RAG on cybersecurity telemetry, delivering an entity-anchored pipeline that achieves a +67.5% Recall@1 boost."*
  - *"2. Implemented a fully sovereign on-premise SOC assistant eliminating cloud telemetry leakage and third-party API dependencies."*
  - *"3. Engineered a verifiable citation governance engine with automated reference-ID checking and hallucination trapping (97.3% validity)."*
  - *"4. Executed an independently audited 120-run tri-mode benchmark on 40 curated scenarios with reproducible methodology and honest failure analysis."*

---

### Slide 18: Implementation Status & Project Roadmap
- **Visuals:** Review 3 Completed Milestones vs. Roadmap to Final Defense.
- **Talking Points:**
  - *"For the third review, all key milestones are 100% complete: database migration, full benchmark execution, integrity audit, retrieval ablation, and publication visualization assets."*
  - *"Our roadmap to the Final Defense (Fourth Review) consists of four targeted steps:"*
  - *"1. Historical Trace Persistence: Store real per-stage execution durations in PostgreSQL rather than synthetic estimates."*
  - *"2. Live Remote Wazuh Deployment: Connect our verified OpenSearch connector to an external live Wazuh cluster."*
  - *"3. Distractor Suppression: Add prompt constraints to prevent contextual over-prediction (resolving Case 20)."*
  - *"4. Automated Schema Repair: Implement JSON fallback repair to eliminate formatting failures (resolving Case 24)."*

---

### Slide 19: Conclusion & Defense Q&A
- **Visuals:** Summary of Deliverables & Discussion Card.
- **Talking Points:**
  - *"In conclusion, we have built, verified, and benchmarked a fully sovereign, evidence-grounded AI assistant for Security Operations Centers."*
  - *"We have demonstrated that Entity Anchoring solves the fundamental retrieval bottleneck in security telemetry, and that while raw LLMs can classify familiar patterns, RAG is indispensable for CVE grounding and citation veracity."*
  - *"Thank you for your time and guidance. We now welcome questions and discussion from the evaluation committee."*

---

## Anticipated Faculty Questions & Defensible Answers

### Q1: "Why did LLM-Only get a higher F1 score (0.9028) than your Evidence-Aware RAG (0.8611)?"
> **Defensible Answer:**  
> *"On 34 out of 36 attack scenarios, LLM-Only and Evidence-Aware RAG achieved identical technique predictions. The small difference is entirely due to two edge cases: in Case 20, the rich ATT&CK context retrieved mentioned related techniques (`T1036` and `T1050`), which distracted the 8B LLM into predicting them as extra techniques (generating 2 false positives). In Case 24, the LLM had a minor JSON formatting glitch that our safe parser handled by returning empty predictions.  
> More importantly, LLM-Only is completely incapable of grounding specific CVEs (it scored 0.0 F1 on Log4Shell, whereas RAG scored 1.0) and cannot provide verifiable citations for human auditability."*

### Q2: "Token Hashing achieved 92.5% Recall@1, beating Evidence-Aware RAG (90.0%). Why not just use Token Hashing?"
> **Defensible Answer:**  
> *"Token Hashing is an offline lexical retrieval baseline that matches exact token strings. In our benchmark, alerts frequently contain exact MITRE IDs in their rule metadata, which lexical hashing matches very quickly. However, Token Hashing cannot perform semantic similarity search—if an alert describes adversary behavior without containing the exact MITRE keyword, hashing fails completely. Entity-Anchored RAG provides the best of both worlds: semantic understanding with targeted entity filtering."*

### Q3: "What does your 97.3% citation validity metric actually prove?"
> **Defensible Answer:**  
> *"It proves that in 36 of 37 citations generated by the LLM across attack cases, the cited reference ID actually existed in the retrieved knowledge base. It guarantees that the LLM is not inventing non-existent technique IDs out of thin air. We explicitly qualify that reference-ID existence does not prove formal semantic entailment of every prose word—that remains a valuable avenue for future natural language inference research."*

### Q4: "Is your system tested on live Wazuh SIEM telemetry?"
> **Defensible Answer:**  
> *"Our backend includes a fully implemented OpenSearch and Wazuh transport client with complete data normalization and isolated data-source provenance (`c01_datasource`). For this third review, we verified the pipeline end-to-end using structured enterprise scenarios and replay datasets because hosting a multi-node live Wazuh cluster on our local host alongside the 8B LLM exceeds host RAM limits. Deploying the connector to a dedicated remote Wazuh server is part of our final defense roadmap."*

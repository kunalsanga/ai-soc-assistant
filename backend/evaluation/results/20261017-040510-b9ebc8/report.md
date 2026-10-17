# Evaluation Report

- Run ID: 20261017-040510-b9ebc8
- Timestamp (UTC): 2026-10-17T04:34:05.260805+00:00
- Dataset: v1 (8 cases)
- LLM: qwen3:8b @ http://localhost:11434 (temperature 0.0)
- Embedding: sentence-transformers/all-MiniLM-L6-v2
- Qdrant collection: security_knowledge

## Aggregate results per mode (measured)

| Metric | llm_only | standard_rag | evidence_aware |
|---|---|---|---|

| Wall latency mean (s) | N/A | N/A | N/A |
| Wall latency median (s) | N/A | N/A | N/A |
| Wall latency stdev (s) | N/A | N/A | N/A |
| LLM latency mean (s) | N/A | N/A | N/A |
| Severity band accuracy* | 0.500 | 0.500 | 0.500 |
| Severity parseable cases | 8.000 | 8.000 | 8.000 |
| Technique precision | 1.000 | 1.000 | 1.000 |
| Technique recall | 0.750 | 0.750 | 0.750 |
| Technique F1 | 0.833 | 0.833 | 0.833 |
| Valid evidence reference rate | N/A | 1.000 | 1.000 |
| Grounding coverage (cases) | 0.000 | 8.000 | 8.000 |
| Retrieval Recall@5 | 0.000 | 0.500 | 1.000 |
| Retrieval Recall@1 | 0.000 | 0.250 | 1.000 |
| Retrieval MRR | 0.000 | 0.354 | 1.000 |
| Errors | 0.000 | 0.000 | 0.000 |

*Severity band accuracy counts only analyses whose severity text yielded a band word; coverage is reported next to it. No imputation is applied.

## Retrieval ablation (retrieval-only, no LLM)

| Config | Recall@5 | Recall@1 | MRR | Avg latency (ms) |
|---|---|---|---|---|
| semantic_anchored | 1.000 | 1.000 | 1.000 | 1563 |
| semantic_no_anchoring | 0.625 | 0.375 | 0.463 | 338 |
| hashing | 1.000 | 1.000 | 1.000 | 52 |

## Per-case results

- case-01-ssh-bruteforce [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=55.2s
- case-01-ssh-bruteforce [standard_rag]: rank=None P=1.0 R=0.5 grounding=1.0 latency=128.7s
- case-01-ssh-bruteforce [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=98.0s
- case-02-password-spray [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=45.9s
- case-02-password-spray [standard_rag]: rank=None P=1.0 R=0.5 grounding=1.0 latency=85.8s
- case-02-password-spray [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=87.1s
- case-03-webshell-upload [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=47.6s
- case-03-webshell-upload [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=98.4s
- case-03-webshell-upload [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=87.5s
- case-04-scheduled-task-persistence [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=36.1s
- case-04-scheduled-task-persistence [standard_rag]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=72.8s
- case-04-scheduled-task-persistence [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=67.7s
- case-05-sudoers-modification [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=39.9s
- case-05-sudoers-modification [standard_rag]: rank=2 P=1.0 R=0.5 grounding=1.0 latency=81.5s
- case-05-sudoers-modification [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=105.5s
- case-06-encoded-powershell [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=37.0s
- case-06-encoded-powershell [standard_rag]: rank=3 P=1.0 R=1.0 grounding=1.0 latency=83.1s
- case-06-encoded-powershell [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=77.4s
- case-07-port-scan [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=35.5s
- case-07-port-scan [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=70.4s
- case-07-port-scan [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=62.4s
- case-08-shadow-copy-deletion [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=35.4s
- case-08-shadow-copy-deletion [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=71.1s
- case-08-shadow-copy-deletion [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=103.3s

## Limitations

- Small hand-authored dataset (smoke-scale); results indicate behavior, they do not establish statistical significance.
- Severity grading uses band-word extraction from free text and may miss paraphrases (coverage reported).
- Technique matching is exact-id; base/sub-technique equivalences are not credited.
# Evaluation Report

- Run ID: 20261024-144522-b29f94
- Timestamp (UTC): 2026-10-24T14:48:45.800796+00:00
- Dataset: v2 (1 cases) [Synthetic: True]
- Dataset file: /app/evaluation/dataset_v2.json
- LLM: qwen3:8b @ http://host.docker.internal:11434 (temperature 0.0)
- Embedding: sentence-transformers/all-MiniLM-L6-v2
- Qdrant collection: security_knowledge

## Aggregate results per mode (measured)

| Metric | llm_only | standard_rag | evidence_aware |
|---|---|---|---|

| Wall latency mean (s) | N/A | N/A | N/A |
| Wall latency median (s) | N/A | N/A | N/A |
| Wall latency stdev (s) | N/A | N/A | N/A |
| LLM latency mean (s) | N/A | N/A | N/A |
| Severity band accuracy* | 1.000 | 1.000 | 1.000 |
| Severity parseable cases | 1.000 | 1.000 | 1.000 |
| Technique precision | 1.000 | 1.000 | 1.000 |
| Technique recall | 0.500 | 0.500 | 0.500 |
| Technique F1 | 0.667 | 0.667 | 0.667 |
| CVE precision | 1.000 | 1.000 | 1.000 |
| CVE recall | 1.000 | 1.000 | 1.000 |
| CVE F1 | 1.000 | 1.000 | 1.000 |
| Benign cases evaluated | 0.000 | 0.000 | 0.000 |
| Benign false alarms (high/crit) | 0.000 | 0.000 | 0.000 |
| Benign false alarm rate | N/A | N/A | N/A |
| Benign correct classification | N/A | N/A | N/A |
| Valid evidence reference rate | N/A | 1.000 | 1.000 |
| Grounding coverage (cases) | 0.000 | 1.000 | 1.000 |
| Retrieval Recall@5 | 0.000 | 0.000 | 1.000 |
| Retrieval Recall@1 | 0.000 | 0.000 | 1.000 |
| Retrieval MRR | 0.000 | 0.000 | 1.000 |
| Errors | 0.000 | 0.000 | 0.000 |

*Severity band accuracy counts only analyses whose severity text yielded a band word; coverage is reported next to it. No imputation is applied.

## Per-case results

- case-01-ssh-bruteforce [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=52.3s
- case-01-ssh-bruteforce [standard_rag]: rank=None P=1.0 R=0.5 grounding=1.0 latency=85.4s
- case-01-ssh-bruteforce [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=64.9s

## Limitations

- Hand-authored synthetic dataset with negative controls; all records are explicitly simulated.
- Severity grading uses band-word extraction from free text and may miss paraphrases (coverage reported).
- Technique matching is exact-id; base/sub-technique equivalences are not credited.
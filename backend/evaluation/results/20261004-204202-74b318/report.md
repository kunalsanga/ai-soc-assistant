# Evaluation Report

- Run ID: 20261004-204202-74b318
- Timestamp (UTC): 2026-10-04T20:42:39.351483+00:00
- Dataset: v1 (1 cases)
- LLM: qwen3:8b @ http://localhost:11434 (temperature 0.0)
- Embedding: sentence-transformers/all-MiniLM-L6-v2
- Qdrant collection: security_knowledge

## Aggregate results per mode (measured)

| Metric | llm_only |
|---|---|

| Wall latency mean (s) | N/A | N/A | N/A |
| Wall latency median (s) | N/A | N/A | N/A |
| Wall latency stdev (s) | N/A | N/A | N/A |
| LLM latency mean (s) | N/A | N/A | N/A |
| Severity band accuracy* | 1.000 | N/A | N/A |
| Severity parseable cases | 1.000 | N/A | N/A |
| Technique precision | 1.000 | N/A | N/A |
| Technique recall | 0.500 | N/A | N/A |
| Technique F1 | 0.667 | N/A | N/A |
| Valid evidence reference rate | N/A | N/A | N/A |
| Grounding coverage (cases) | 0.000 | N/A | N/A |
| Retrieval Recall@5 | 0.000 | N/A | N/A |
| Retrieval Recall@1 | 0.000 | N/A | N/A |
| Retrieval MRR | 0.000 | N/A | N/A |
| Errors | 0.000 | N/A | N/A |

*Severity band accuracy counts only analyses whose severity text yielded a band word; coverage is reported next to it. No imputation is applied.

## Per-case results

- case-01-ssh-bruteforce [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=36.5s

## Limitations

- Small hand-authored dataset (smoke-scale); results indicate behavior, they do not establish statistical significance.
- Severity grading uses band-word extraction from free text and may miss paraphrases (coverage reported).
- Technique matching is exact-id; base/sub-technique equivalences are not credited.
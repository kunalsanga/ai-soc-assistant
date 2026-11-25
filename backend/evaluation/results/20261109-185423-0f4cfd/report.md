# Evaluation Report

- Run ID: 20261109-185423-0f4cfd
- Timestamp (UTC): 2026-11-09T20:29:40.852691+00:00
- Dataset: v2 (40 cases) [Synthetic: True]
- Dataset file: C:\Users\kunal sanga\OneDrive\Code files\PPD2\soc-assistant\backend\evaluation\dataset_v2.json
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
| Severity band accuracy* | 0.564 | 0.605 | 0.564 |
| Severity parseable cases | 39.000 | 38.000 | 39.000 |
| Technique precision | 0.986 | 0.958 | 0.940 |
| Technique recall | 0.861 | 0.833 | 0.833 |
| Technique F1 | 0.903 | 0.875 | 0.861 |
| CVE precision | 0.975 | 1.000 | 1.000 |
| CVE recall | 0.975 | 1.000 | 1.000 |
| CVE F1 | 0.975 | 1.000 | 1.000 |
| Benign cases evaluated | 4.000 | 4.000 | 4.000 |
| Benign false alarms (high/crit) | 1.000 | 1.000 | 1.000 |
| Benign false alarm rate | 0.250 | 0.250 | 0.250 |
| Benign correct classification | 0.750 | 0.750 | 0.750 |
| Valid evidence reference rate | N/A | 1.000 | 0.973 |
| Grounding coverage (cases) | 0.000 | 38.000 | 37.000 |
| Retrieval Recall@5 | 0.000 | 0.625 | 0.925 |
| Retrieval Recall@1 | 0.000 | 0.325 | 0.900 |
| Retrieval MRR | 0.000 | 0.434 | 0.912 |
| Errors | 0.000 | 0.000 | 0.000 |

*Severity band accuracy counts only analyses whose severity text yielded a band word; coverage is reported next to it. No imputation is applied.

## Retrieval ablation (retrieval-only, no LLM)

| Config | Recall@5 | Recall@1 | MRR | Avg latency (ms) |
|---|---|---|---|---|
| semantic_anchored | 0.925 | 0.900 | 0.912 | 240 |
| semantic_no_anchoring | 0.400 | 0.225 | 0.274 | 51 |
| hashing | 0.925 | 0.925 | 0.925 | 39 |

## Per-case results

- case-01-ssh-bruteforce [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=29.6s
- case-01-ssh-bruteforce [standard_rag]: rank=None P=1.0 R=0.5 grounding=None latency=43.0s
- case-01-ssh-bruteforce [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=43.0s
- case-02-password-spray [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=20.2s
- case-02-password-spray [standard_rag]: rank=None P=1.0 R=0.5 grounding=1.0 latency=77.2s
- case-02-password-spray [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=54.1s
- case-03-kerberoasting [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=23.4s
- case-03-kerberoasting [standard_rag]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=52.4s
- case-03-kerberoasting [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=68.1s
- case-04-mfa-fatigue-bombing [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=23.6s
- case-04-mfa-fatigue-bombing [standard_rag]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=46.1s
- case-04-mfa-fatigue-bombing [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=42.7s
- case-05-encoded-powershell [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=21.7s
- case-05-encoded-powershell [standard_rag]: rank=3 P=1.0 R=1.0 grounding=1.0 latency=45.5s
- case-05-encoded-powershell [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=77.8s
- case-06-powershell-download-cradle [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=24.4s
- case-06-powershell-download-cradle [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=55.6s
- case-06-powershell-download-cradle [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=92.7s
- case-07-suspicious-wscript-launch [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=24.0s
- case-07-suspicious-wscript-launch [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=47.6s
- case-07-suspicious-wscript-launch [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=42.5s
- case-08-bash-reverse-shell [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=24.3s
- case-08-bash-reverse-shell [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=63.1s
- case-08-bash-reverse-shell [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=50.2s
- case-09-shadow-copy-deletion [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=24.3s
- case-09-shadow-copy-deletion [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=56.1s
- case-09-shadow-copy-deletion [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=52.6s
- case-10-bcdr-disable-recovery [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=22.5s
- case-10-bcdr-disable-recovery [standard_rag]: rank=3 P=1.0 R=1.0 grounding=1.0 latency=42.3s
- case-10-bcdr-disable-recovery [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=44.8s
- case-11-ransom-note-drop [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=23.3s
- case-11-ransom-note-drop [standard_rag]: rank=2 P=0.0 R=0.0 grounding=None latency=50.4s
- case-11-ransom-note-drop [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=48.8s
- case-12-suspicious-svchost-spawn [llm_only]: rank=None P=0.5 R=0.5 grounding=None latency=28.0s
- case-12-suspicious-svchost-spawn [standard_rag]: rank=None P=0.5 R=0.5 grounding=1.0 latency=56.9s
- case-12-suspicious-svchost-spawn [evidence_aware]: rank=2 P=0.5 R=0.5 grounding=1.0 latency=51.6s
- case-13-sudoers-modification [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=24.3s
- case-13-sudoers-modification [standard_rag]: rank=2 P=1.0 R=0.5 grounding=1.0 latency=49.9s
- case-13-sudoers-modification [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=51.2s
- case-14-suid-binary-creation [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=24.9s
- case-14-suid-binary-creation [standard_rag]: rank=5 P=1.0 R=0.5 grounding=1.0 latency=49.5s
- case-14-suid-binary-creation [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=45.3s
- case-15-uac-bypass-fodhelper [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=25.3s
- case-15-uac-bypass-fodhelper [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=58.9s
- case-15-uac-bypass-fodhelper [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=54.6s
- case-16-token-privilege-abuse [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=26.0s
- case-16-token-privilege-abuse [standard_rag]: rank=3 P=1.0 R=1.0 grounding=1.0 latency=55.3s
- case-16-token-privilege-abuse [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=56.1s
- case-17-scheduled-task-persistence [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=21.8s
- case-17-scheduled-task-persistence [standard_rag]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=49.7s
- case-17-scheduled-task-persistence [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=41.2s
- case-18-registry-run-key [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=23.4s
- case-18-registry-run-key [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=50.2s
- case-18-registry-run-key [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=53.1s
- case-19-linux-cron-backdoor [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=23.6s
- case-19-linux-cron-backdoor [standard_rag]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=62.7s
- case-19-linux-cron-backdoor [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=45.3s
- case-20-new-system-service [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=22.1s
- case-20-new-system-service [standard_rag]: rank=3 P=1.0 R=1.0 grounding=1.0 latency=50.9s
- case-20-new-system-service [evidence_aware]: rank=1 P=0.3333333333333333 R=1.0 grounding=1.0 latency=58.1s
- case-21-dns-data-tunneling [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=22.3s
- case-21-dns-data-tunneling [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=48.9s
- case-21-dns-data-tunneling [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=60.1s
- case-22-c2-beaconing-fixed-jitter [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=25.2s
- case-22-c2-beaconing-fixed-jitter [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=51.0s
- case-22-c2-beaconing-fixed-jitter [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=0.0 latency=41.4s
- case-23-external-recon-portscan [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=21.9s
- case-23-external-recon-portscan [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=47.2s
- case-23-external-recon-portscan [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=35.9s
- case-24-unusual-outbound-rdp [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=22.1s
- case-24-unusual-outbound-rdp [standard_rag]: rank=3 P=1.0 R=1.0 grounding=1.0 latency=50.3s
- case-24-unusual-outbound-rdp [evidence_aware]: rank=1 P=0.0 R=0.0 grounding=None latency=50.9s
- case-25-staging-archive-7zip [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=24.4s
- case-25-staging-archive-7zip [standard_rag]: rank=4 P=1.0 R=1.0 grounding=1.0 latency=60.2s
- case-25-staging-archive-7zip [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=45.0s
- case-26-cloud-mega-upload [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=27.8s
- case-26-cloud-mega-upload [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=55.3s
- case-26-cloud-mega-upload [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=43.3s
- case-27-unauthorized-scp-egress [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=28.9s
- case-27-unauthorized-scp-egress [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=47.4s
- case-27-unauthorized-scp-egress [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=46.0s
- case-28-clipboard-harvesting [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=23.9s
- case-28-clipboard-harvesting [standard_rag]: rank=2 P=1.0 R=1.0 grounding=1.0 latency=37.0s
- case-28-clipboard-harvesting [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=37.4s
- case-29-log4shell-exploitation [llm_only]: rank=None P=1.0 R=1.0 grounding=None CVE_F1=0.0 latency=21.6s
- case-29-log4shell-exploitation [standard_rag]: rank=2 P=1.0 R=1.0 grounding=1.0 CVE_F1=1.0 latency=59.8s
- case-29-log4shell-exploitation [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 CVE_F1=1.0 latency=80.2s
- case-30-webshell-jsp-drop [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=26.0s
- case-30-webshell-jsp-drop [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=49.1s
- case-30-webshell-jsp-drop [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=47.0s
- case-31-sqli-union-select [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=22.2s
- case-31-sqli-union-select [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=48.2s
- case-31-sqli-union-select [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=50.3s
- case-32-path-traversal-passwd [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=21.5s
- case-32-path-traversal-passwd [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=51.8s
- case-32-path-traversal-passwd [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=47.7s
- case-33-double-extension-exe [llm_only]: rank=None P=1.0 R=0.5 grounding=None latency=26.3s
- case-33-double-extension-exe [standard_rag]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=57.7s
- case-33-double-extension-exe [evidence_aware]: rank=1 P=1.0 R=0.5 grounding=1.0 latency=63.8s
- case-34-hidden-alternate-data-stream [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=23.0s
- case-34-hidden-alternate-data-stream [standard_rag]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=56.0s
- case-34-hidden-alternate-data-stream [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=41.3s
- case-35-unsigned-driver-load [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=24.9s
- case-35-unsigned-driver-load [standard_rag]: rank=4 P=1.0 R=1.0 grounding=1.0 latency=60.9s
- case-35-unsigned-driver-load [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=62.7s
- case-36-sensitive-file-staging [llm_only]: rank=None P=1.0 R=1.0 grounding=None latency=26.2s
- case-36-sensitive-file-staging [standard_rag]: rank=None P=1.0 R=1.0 grounding=1.0 latency=51.3s
- case-36-sensitive-file-staging [evidence_aware]: rank=1 P=1.0 R=1.0 grounding=1.0 latency=57.5s
- case-37-authorized-nessus-scan [BENIGN] [llm_only]: rank=None P=None R=None grounding=None latency=27.9s
- case-37-authorized-nessus-scan [BENIGN] [standard_rag]: rank=None P=None R=None grounding=1.0 latency=51.4s
- case-37-authorized-nessus-scan [BENIGN] [evidence_aware]: rank=1 P=None R=None grounding=1.0 latency=39.2s
- case-38-routine-backup-service [BENIGN] [llm_only]: rank=None P=None R=None grounding=None latency=23.9s
- case-38-routine-backup-service [BENIGN] [standard_rag]: rank=None P=None R=None grounding=1.0 latency=46.1s
- case-38-routine-backup-service [BENIGN] [evidence_aware]: rank=None P=None R=None grounding=None latency=26.4s
- case-39-developer-git-ssh-clone [BENIGN] [llm_only]: rank=None P=None R=None grounding=None latency=19.3s
- case-39-developer-git-ssh-clone [BENIGN] [standard_rag]: rank=None P=None R=None grounding=1.0 latency=39.7s
- case-39-developer-git-ssh-clone [BENIGN] [evidence_aware]: rank=None P=None R=None grounding=None latency=26.1s
- case-40-windows-update-powershell [BENIGN] [llm_only]: rank=None P=None R=None grounding=None latency=20.7s
- case-40-windows-update-powershell [BENIGN] [standard_rag]: rank=None P=None R=None grounding=1.0 latency=32.7s
- case-40-windows-update-powershell [BENIGN] [evidence_aware]: rank=None P=None R=None grounding=1.0 latency=44.4s

## Limitations

- Hand-authored synthetic dataset with negative controls; all records are explicitly simulated.
- Severity grading uses band-word extraction from free text and may miss paraphrases (coverage reported).
- Technique matching is exact-id; base/sub-technique equivalences are not credited.
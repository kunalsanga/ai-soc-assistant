/**
 * AI SOC Assistant — Mock Evidence Data
 *
 * ⚠ DEVELOPMENT DATA — Clearly marked mock evidence.
 * Aligned with backend Evidence schema:
 * { id, analysis_id, source, document_id, title, content, relevance_score, citation }
 */

import type { Evidence } from '../types/alert';

export const mockEvidenceList: Evidence[] = [
  {
    id: 101,
    analysis_id: 1,
    source: 'MITRE ATT&CK Enterprise Matrix v14',
    document_id: 'T1110.001',
    title: 'Brute Force: Password Guessing',
    content:
      'Adversaries may iterate through passwords against accounts to gain valid credentials. SSH brute-forcing typically manifests as hundreds of PAM failure events in short intervals with varying username dictionaries.',
    relevance_score: 0.94,
    citation: 'MITRE Enterprise Matrix T1110.001 (Credential Access)',
  },
  {
    id: 102,
    analysis_id: 1,
    source: 'NIST SP 800-61 Rev. 2',
    document_id: 'NIST-IR-AUTH',
    title: 'Computer Security Incident Handling Guide - Unauthorized Access',
    content:
      'Recommended containment: Isolate the source IP at edge firewall or tcpwrappers, terminate active sessions originating from 10.0.3.47, and verify root authorized_keys integrity.',
    relevance_score: 0.88,
    citation: 'NIST Computer Security Incident Handling Guide (Sec 3.2.5)',
  },
  {
    id: 103,
    analysis_id: 2,
    source: 'MITRE ATT&CK Enterprise Matrix v14',
    document_id: 'T1059.001',
    title: 'Command and Scripting Interpreter: PowerShell',
    content:
      'Adversaries may abuse PowerShell commands and scripts for execution. Encoded command flags (-enc, -EncodedCommand) frequently obscure base64-encoded download cradles and in-memory payloads.',
    relevance_score: 0.96,
    citation: 'MITRE Enterprise Matrix T1059.001 (Execution)',
  },
  {
    id: 104,
    analysis_id: 2,
    source: 'Internal Runbook - Endpoint Compromise',
    document_id: 'SOP-EP-04',
    title: 'Suspicious Office Macro & PowerShell Spawn Playbook',
    content:
      'Immediate action: Quarantine endpoint win-desktop-03 from network, preserve memory snapshot for volatility analysis, and inspect outlook attachment cache for inbound dropper email.',
    relevance_score: 0.91,
    citation: 'SecOps Standard Operating Procedure SOP-EP-04',
  },
  {
    id: 105,
    analysis_id: 3,
    source: 'MITRE ATT&CK Enterprise Matrix v14',
    document_id: 'T1068',
    title: 'Exploitation for Privilege Escalation',
    content:
      'Adversaries may exploit software vulnerabilities in elevated processes or kernel modules to elevate privileges from low-privileged developer accounts.',
    relevance_score: 0.85,
    citation: 'MITRE Enterprise Matrix T1068 (Privilege Escalation)',
  },
];

export const getEvidenceForAlert = (alertId: number): Evidence[] => {
  if (alertId === 1) return [mockEvidenceList[0], mockEvidenceList[1]];
  if (alertId === 2) return [mockEvidenceList[2], mockEvidenceList[3]];
  if (alertId === 3) return [mockEvidenceList[4]];
  return [
    {
      id: 200 + alertId,
      analysis_id: alertId,
      source: 'Internal Security Knowledge Base (Development)',
      document_id: `KB-DEV-00${alertId}`,
      title: 'Baseline Security Telemetry Reference',
      content:
        'Standard operational baseline rule documentation. Indicates typical remediation protocols and diagnostic logging instructions.',
      relevance_score: 0.78,
      citation: 'KB-DEV-Telemetry Guideline Sec 4',
    },
  ];
};

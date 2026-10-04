/**
 * AI SOC Assistant — Mock AI Analysis Data
 *
 * ⚠ DEVELOPMENT DATA — Clearly marked mock AI Analysis.
 * Aligned with backend Analysis schema:
 * { id, alert_id, summary, severity_assessment, explanation, recommended_investigation, confidence, model_name, analysis_type, evidence }
 */

import type { Analysis } from '../types/alert';
import { getEvidenceForAlert } from './mockEvidence';

export const mockAnalysisMap: Record<number, Analysis> = {
  1: {
    id: 1,
    alert_id: 1,
    status: 'completed',
    summary:
      'High-velocity SSH brute force campaign originating from internal subnet IP 10.0.3.47 targeting bastion host root account.',
    severity_assessment:
      'CRITICAL (Severity 14/15) — Potential lateral movement or compromised internal staging node attempting credential stuffing against mission-critical gateway.',
    explanation:
      'Wazuh rule 5710 fired following 48 failed authentication attempts within 60 seconds against port 22 on linux-prod-01. The attacker is targeting the root account without public key credentials.',
    suspected_attack: 'MITRE ATT&CK T1110.001 (Brute Force: Password Guessing)',
    recommended_investigation:
      '1. Temporarily null-route or block traffic from 10.0.3.47 at host firewall.\n2. Review auth.log for successful logins immediately preceding or following this cluster.\n3. Validate root account lock status and authorized_keys file integrity on linux-prod-01.\n4. Triage source host 10.0.3.47 for malware or unauthorized SSH client automated scripts.',
    confidence: '0.94',
    model_name: 'SecOps-RAG-Mistral-7B / Baseline-v1',
    analysis_type: 'evidence_grounded_rag',
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    evidence: getEvidenceForAlert(1),
  } as Analysis & { suspected_attack?: string },
  2: {
    id: 2,
    alert_id: 2,
    status: 'completed',
    summary:
      'Encoded PowerShell execution spawned from Microsoft Excel process on finance workstation win-desktop-03.',
    severity_assessment:
      'HIGH (Severity 12/15) — Strong indicator of malicious macro execution attempting memory injection or outbound C2 download cradle.',
    explanation:
      'Sysmon Event 1 detected excel.exe launching powershell.exe with -WindowStyle Hidden and base64 encoded parameters. Process attempted immediate TLS connection to 198.51.100.42.',
    suspected_attack: 'MITRE ATT&CK T1059.001 (Command and Scripting Interpreter: PowerShell)',
    recommended_investigation:
      '1. Isolate win-desktop-03 from the enterprise LAN via endpoint agent.\n2. Decode the base64 command string from Sysmon logs.\n3. Inspect user j.smith recent Outlook attachments and email provenance.\n4. Check DNS queries for newly registered domain beacons.',
    confidence: '0.91',
    model_name: 'SecOps-RAG-Mistral-7B / Baseline-v1',
    analysis_type: 'evidence_grounded_rag',
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    evidence: getEvidenceForAlert(2),
  } as Analysis & { suspected_attack?: string },
};

export const getMockAnalysisForAlert = (alertId: number): Analysis => {
  if (mockAnalysisMap[alertId]) {
    return mockAnalysisMap[alertId];
  }

  return {
    id: 100 + alertId,
    alert_id: alertId,
    status: 'completed',
    summary: `Automated baseline analysis for alert #${alertId}. Standard detection telemetry evaluated against reference security playbooks.`,
    severity_assessment: 'MEDIUM (Severity 8/15) — Telemetry requires standard tier-1 analyst verification.',
    explanation:
      'Alert rule matched predefined behavioral threshold. Preliminary inspection indicates operational anomaly without confirmed malicious exploit artifact.',
    recommended_investigation:
      '1. Verify user session context.\n2. Correlate with concurrent endpoint events.\n3. Close alert or escalate to Tier 2 if anomalous behavior repeats within 4 hours.',
    confidence: '0.82',
    model_name: 'SecOps-RAG-Mistral-7B / Baseline-v1',
    analysis_type: 'evidence_grounded_rag',
    created_at: new Date().toISOString(),
    evidence: getEvidenceForAlert(alertId),
  };
};

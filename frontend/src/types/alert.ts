/**
 * AI SOC Assistant — Core Type Definitions
 *
 * Aligned with backend schemas (backend/app/schemas/alert.py).
 * Frontend-only additions are clearly marked.
 */

/* ============================================================
   ALERT
   ============================================================ */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Alert {
  id: number;
  external_alert_id: string;
  timestamp: string;
  severity: number;
  rule_id: string;
  rule_description: string;
  agent_name: string;
  source_ip?: string;
  destination_ip?: string;
  username?: string;
  raw_data?: string;
  status: string;
  created_at: string;
}

/** Frontend helper: map numeric severity to named level */
export function getSeverityLevel(severity: number): SeverityLevel {
  if (severity >= 12) return 'critical';
  if (severity >= 8) return 'high';
  if (severity >= 5) return 'medium';
  if (severity >= 2) return 'low';
  return 'info';
}

/** Frontend helper: human label for severity */
export function getSeverityLabel(severity: number): string {
  const level = getSeverityLevel(severity);
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/* ============================================================
   EVIDENCE
   ============================================================ */

export interface Evidence {
  id: number;
  analysis_id: number;
  source: string;
  document_id: string;
  title: string;
  content: string;
  relevance_score: number;
  citation: string;
}

/* ============================================================
   ANALYSIS
   ============================================================ */

export interface Analysis {
  status?: string;
  message?: string;
  id?: number;
  alert_id?: number;
  summary?: string;
  severity_assessment?: string;
  explanation?: string;
  recommended_investigation?: string;
  confidence?: string;
  model_name?: string;
  analysis_type?: string;
  created_at?: string;
  evidence?: Evidence[];
}

/* ============================================================
   SECURITY CONTEXT (Frontend-only display model)
   ============================================================ */

export interface NetworkContext {
  source_ip?: string;
  destination_ip?: string;
  protocol?: string;
  port?: number;
  connection_info?: string;
}

export interface IdentityContext {
  username?: string;
  agent_name?: string;
  hostname?: string;
}

export interface ExecutionContext {
  process?: string;
  command?: string;
  parent_process?: string;
}

export interface DetectionContext {
  rule_id?: string;
  rule_description?: string;
  decoder?: string;
  severity?: number;
}

export interface IntelligenceContext {
  mitre_techniques?: string[];
  cve_ids?: string[];
  reputation?: string;
  threat_intel?: string;
}

export interface SecurityContext {
  network: NetworkContext;
  identity: IdentityContext;
  execution: ExecutionContext;
  detection: DetectionContext;
  intelligence: IntelligenceContext;
}

/* ============================================================
   THREAT INTELLIGENCE (Frontend-only display model)
   ============================================================ */

export interface ThreatIntelItem {
  id: string;
  type: 'mitre_technique' | 'cve' | 'ip_reputation' | 'domain' | 'indicator';
  title: string;
  description?: string;
  severity?: SeverityLevel;
  source?: string;
  last_updated?: string;
}

/* ============================================================
   INVESTIGATION (Frontend-only display model)
   ============================================================ */

export type InvestigationStage =
  | 'alert_detected'
  | 'normalized'
  | 'context_extracted'
  | 'threat_intelligence'
  | 'evidence_retrieved'
  | 'ai_analysis'
  | 'analyst_review';

export type StageStatus = 'completed' | 'in_progress' | 'pending' | 'not_available';

export interface InvestigationTimelineStep {
  stage: InvestigationStage;
  label: string;
  description: string;
  status: StageStatus;
  timestamp?: string;
}

export interface Investigation {
  id: string;
  alert_id: number;
  alert: Alert;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  analyst?: string;
  timeline: InvestigationTimelineStep[];
  analysis?: Analysis;
  created_at: string;
  updated_at: string;
}

/* ============================================================
   SYSTEM STATUS (Frontend-only display model)
   ============================================================ */

export type SystemComponentStatus = 'operational' | 'degraded' | 'down' | 'integration_pending';

export interface SystemComponent {
  name: string;
  status: SystemComponentStatus;
  description?: string;
}

/* ============================================================
   PROJECT STATUS (Frontend-only display model)
   ============================================================ */

export type ProjectStatus = 'implemented' | 'in_progress' | 'integration_pending' | 'not_started';

export interface ProjectModule {
  name: string;
  status: ProjectStatus;
  description?: string;
  owner?: string;
}

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

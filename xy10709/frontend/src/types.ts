export interface UploadTask {
  id: number;
  task_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  file_path: string;
  file_hash_md5: string;
  file_hash_sha256: string;
  status: string;
  isolation_status: string;
  scan_engine: string;
  scan_result: string;
  threat_level: string;
  organization_id: number;
  uploaded_by: string;
  uploaded_at: string;
  scanned_at: string;
  processed_at: string;
  raw_input: string;
  processed_result: string;
  notes: string;
  organization?: Organization;
  security_logs?: SecurityLog[];
}

export interface SecurityLog {
  id: number;
  log_id: string;
  upload_task_id: number;
  event_type: string;
  severity: string;
  message: string;
  source_ip: string;
  user_agent: string;
  details: string;
  created_at: string;
  resolved: boolean;
  resolved_by: string;
  resolved_at: string;
}

export interface Organization {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface ScanRule {
  id: number;
  name: string;
  rule_type: string;
  pattern: string;
  description: string;
  severity: string;
  action: string;
  is_active: boolean;
  created_at: string;
}

export interface Stats {
  total_tasks: number;
  total_logs: number;
  status_counts: Record<string, number>;
  threat_counts: Record<string, number>;
  severity_counts: Record<string, number>;
}

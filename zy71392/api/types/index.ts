export type CloudPlatform = 'aws' | 'aliyun' | 'tencent' | 'gcp';

export interface Script {
  id: number;
  name: string;
  file_type: string;
  content: string;
  cloud_platform: CloudPlatform;
  existing_policy_json: string;
  created_at: string;
  updated_at: string;
}

export interface ApiCall {
  id: number;
  script_id: number;
  service: string;
  action: string;
  resource: string;
  source: 'static' | 'dynamic';
  line_number?: number;
  context?: string;
}

export interface RuntimeLog {
  id: number;
  script_id: number;
  content: string;
  captured_at: string;
}

export interface Permission {
  id: number;
  script_id: number;
  service: string;
  action: string;
  type: 'existing' | 'derived';
  status: 'kept' | 'removed' | 'added' | 'modified';
  reason?: string;
}

export type ExceptionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Exception {
  id: number;
  script_id: number;
  permission_id?: number;
  reason: string;
  status: ExceptionStatus;
  expires_at?: string;
  impact_scope?: string;
  risk_note?: string;
  created_at: string;
}

export interface RiskScore {
  id: number;
  script_id: number;
  dynamic_miss_score: number;
  wildcard_score: number;
  exception_long_score: number;
  total_score: number;
  details_json: string;
  calculated_at: string;
}

export interface RiskDetail {
  id: string;
  type: 'dynamic_miss' | 'wildcard_over' | 'exception_long';
  script_id?: number;
  script_name?: string;
  reason: string;
  impact: string;
  next_action: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export type ReportStatus = 'draft' | 'reviewed' | 'approved';

export interface Report {
  id: number;
  title: string;
  status: ReportStatus;
  created_at: string;
}

export type ReportItemCategory = 'permission_change' | 'risk_item' | 'exception' | 'api_call';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReportItem {
  id: number;
  report_id: number;
  script_id: number;
  category: ReportItemCategory;
  content_json: string;
  review_status: ReviewStatus;
  review_note?: string;
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  metadata_json?: string;
  created_at: string;
}

export interface DashboardStats {
  script_count: number;
  api_call_count: number;
  permission_count: number;
  high_risk_count: number;
  exception_pending_count: number;
  report_draft_count: number;
}

export interface PermissionDiff {
  existing_permissions: Permission[];
  derived_permissions: Permission[];
  removed: Permission[];
  added: Permission[];
  kept: Permission[];
}

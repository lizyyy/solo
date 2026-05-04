export interface Member {
  id: number;
  name: string;
  relationship: string;
  birth_date?: string;
  gender?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Coverage {
  id: number;
  policy_id: number;
  coverage_type: string;
  coverage_limit: number;
  deductible?: number;
  reimbursement_ratio: number;
  waiting_period_days?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Policy {
  id: number;
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  insured_member_id?: number;
  start_date: string;
  end_date: string;
  waiting_period_days: number;
  deductible_amount: number;
  deductible_period: string;
  premium_amount?: number;
  payment_frequency?: string;
  next_renewal_date?: string;
  policy_file_path?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  coverages?: Coverage[];
  member?: Member;
}

export interface Incident {
  id: number;
  incident_number: string;
  incident_type: string;
  incident_date: string;
  report_date?: string;
  affected_member_id?: number;
  description: string;
  location?: string;
  severity: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  member?: Member;
  claims?: Claim[];
}

export interface ClaimStatusTimeline {
  id: number;
  claim_id: number;
  status: string;
  changed_at: string;
  description?: string;
  operator?: string;
}

export interface ClaimDocument {
  id: number;
  claim_id: number;
  document_type: string;
  document_name: string;
  file_path?: string;
  is_submitted: boolean;
  submitted_date?: string;
  is_required: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: number;
  incident_id: number;
  policy_id: number;
  coverage_id?: number;
  claim_number: string;
  submit_date?: string;
  claim_amount?: number;
  approved_amount?: number;
  deductible_applied?: number;
  status: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  policy?: Policy;
  coverage?: Coverage;
  incident?: Incident;
  status_timeline?: ClaimStatusTimeline[];
  documents?: ClaimDocument[];
}

export interface RiskReason {
  type: string;
  message: string;
  severity: string;
}

export interface ToDoItem {
  action: string;
  description: string;
  deadline?: string;
  priority: string;
}

export interface ClaimCalculation {
  incident_id: number;
  policy_id: number;
  policy_number: string;
  insurance_company: string;
  is_coverable: boolean;
  risk_reasons: RiskReason[];
  to_do_items: ToDoItem[];
  estimated_claimable_amount?: number;
  waiting_period_status: string;
  deductible_status: string;
  report_deadline_status: string;
  notes?: string;
}

export interface ClaimAnalysis {
  incident_id: number;
  incident_number: string;
  incident_type: string;
  incident_date: string;
  affected_member_name?: string;
  calculations: ClaimCalculation[];
  overall_summary: string;
  total_estimated_claimable: number;
}

export interface DashboardStats {
  total_policies: number;
  total_members: number;
  active_claims: number;
  pending_incidents: number;
}

export interface ExpiringPolicy {
  id: number;
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  member_name: string;
  end_date: string;
  days_remaining: number;
  next_renewal_date?: string;
}

export interface ExpiredPolicy {
  id: number;
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  member_name: string;
  end_date: string;
  days_since_expiry: number;
}

export interface DuplicateCoverage {
  member_name: string;
  policy_type: string;
  policies: any[];
  total_limit: number;
}

export interface PendingDeductible {
  id: number;
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  member_name: string;
  total_deductible: number;
  total_deducted: number;
  remaining: number;
  deductible_period: string;
}

export interface UrgentReport {
  id: number;
  incident_number: string;
  incident_type: string;
  incident_date: string;
  member_name: string;
  description: string;
  days_since_incident: number;
  days_remaining: number;
  is_overdue: boolean;
}

export interface DashboardAlerts {
  expiring_soon: ExpiringPolicy[];
  already_expired: ExpiredPolicy[];
  duplicate_coverages: DuplicateCoverage[];
  pending_deductibles: PendingDeductible[];
  urgent_reports: UrgentReport[];
}

export interface DashboardData {
  stats: DashboardStats;
  alerts: DashboardAlerts;
  summary: string;
}

export const PolicyTypeMap: Record<string, string> = {
  medical: '医疗险',
  accident: '意外险',
  auto: '车险',
  property: '家财险',
};

export const ClaimStatusMap: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  processing: '审核中',
  additional_info: '需补件',
  paid: '已赔付',
  rejected: '已拒赔',
};

export const IncidentStatusMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  closed: '已结案',
};

export const SeverityMap: Record<string, string> = {
  minor: '轻微',
  moderate: '中等',
  severe: '严重',
  critical: '危急',
};

export const IncidentTypeMap: Record<string, string> = {
  illness: '疾病就医',
  accident_injury: '意外受伤',
  hospitalization: '住院治疗',
  surgery: '手术治疗',
  auto_accident: '交通事故',
  property_damage: '财产损失',
  medical: '疾病住院',
  accident: '意外受伤',
  auto: '车辆事故',
  property: '财产损失',
  other: '其他',
};

export interface ClaimAnalysisRisk {
  risk_type: string;
  risk_level: string;
  description: string;
}

export interface ClaimAnalysisTodo {
  priority: string;
  task: string;
}

export interface ClaimAnalysisDocument {
  document_name: string;
  required: boolean;
  notes?: string;
}

export interface ClaimAnalysisPolicy {
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  is_claimable: boolean;
  reasons?: string[];
}

export interface ClaimAnalysisResult {
  summary: string;
  overall_rating: string;
  risks: ClaimAnalysisRisk[];
  todos: ClaimAnalysisTodo[];
  documents: ClaimAnalysisDocument[];
  affected_policies: ClaimAnalysisPolicy[];
}

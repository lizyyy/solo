export interface Case {
  id: string;
  case_number: string;
  title: string;
  opposing_party: string;
  case_domain: string;
  status: string;
  assigned_lawyer_id?: string;
  assigned_lawyer_name?: string;
  priority: string;
  conflict_status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status_history?: StatusHistory[];
  modifications?: CaseModification[];
  conflict_checks?: ConflictCheck[];
  reassignments?: Reassignment[];
}

export interface Lawyer {
  id: string;
  name: string;
  specialty: string;
  capacity: number;
  current_load: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StatusHistory {
  id: string;
  case_id: string;
  previous_status?: string;
  new_status: string;
  changed_by: string;
  change_reason: string;
  created_at: string;
}

export interface CaseModification {
  id: string;
  case_id: string;
  field_name: string;
  old_value?: string;
  new_value: string;
  modified_by: string;
  created_at: string;
}

export interface ConflictCheck {
  id: string;
  case_id: string;
  opposing_party: string;
  check_result: string;
  conflict_details?: string;
  checked_by: string;
  created_at: string;
}

export interface Reassignment {
  id: string;
  case_id: string;
  from_lawyer_id?: string;
  from_lawyer_name?: string;
  to_lawyer_id: string;
  to_lawyer_name: string;
  reason: string;
  reassigned_by: string;
  follow_up_required: number;
  follow_up_completed: number;
  follow_up_note?: string;
  follow_up_by?: string;
  follow_up_at?: string;
  created_at: string;
}

export interface Statistics {
  total_cases: number;
  pending_cases: number;
  in_progress_cases: number;
  completed_cases: number;
  has_conflict_cases: number;
  cases_by_domain: { domain: string; domain_name: string; count: number }[];
}

export interface LeadFunnelStage {
  stage: string;
  stage_name: string;
  count: number;
  percentage: number;
}

export interface LeadFunnel {
  funnel: LeadFunnelStage[];
  total: number;
}

export const CASE_DOMAINS = [
  { value: 'civil', label: '民事' },
  { value: 'criminal', label: '刑事' },
  { value: 'commercial', label: '商事' },
  { value: 'labor', label: '劳动' },
  { value: 'intellectual_property', label: '知识产权' },
  { value: 'family', label: '家事' },
  { value: 'administrative', label: '行政' },
  { value: 'bankruptcy', label: '破产' }
];

export const CASE_STATUSES = [
  { value: 'pending', label: '待处理', color: '#ffc107' },
  { value: 'assigned', label: '已分派', color: '#17a2b8' },
  { value: 'in_progress', label: '处理中', color: '#007bff' },
  { value: 'review', label: '复核中', color: '#fd7e14' },
  { value: 'completed', label: '已完成', color: '#28a745' },
  { value: 'cancelled', label: '已取消', color: '#6c757d' }
];

export const PRIORITIES = [
  { value: 'low', label: '低', color: '#28a745' },
  { value: 'medium', label: '中', color: '#ffc107' },
  { value: 'high', label: '高', color: '#dc3545' }
];

export const FUNNEL_STAGES = [
  { value: 'lead', label: '线索', color: '#007bff' },
  { value: 'qualified', label: '已确认', color: '#17a2b8' },
  { value: 'proposal', label: '方案中', color: '#28a745' },
  { value: 'negotiation', label: '协商中', color: '#ffc107' },
  { value: 'closed', label: '已结案', color: '#6c757d' }
];

export const getDomainLabel = (domain: string) => {
  return CASE_DOMAINS.find(d => d.value === domain)?.label || domain;
};

export const getStatusLabel = (status: string) => {
  return CASE_STATUSES.find(s => s.value === status)?.label || status;
};

export const getStatusColor = (status: string) => {
  return CASE_STATUSES.find(s => s.value === status)?.color || '#6c757d';
};

export const getPriorityLabel = (priority: string) => {
  return PRIORITIES.find(p => p.value === priority)?.label || priority;
};

export const getPriorityColor = (priority: string) => {
  return PRIORITIES.find(p => p.value === priority)?.color || '#6c757d';
};

export interface ReworkOrder {
  id: number;
  order_no: string;
  product_name: string;
  batch_no: string;
  qty: number;
  defect_qty: number;
  current_status: 'pending' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  rework_count?: number;
  latest_rework_no?: number;
}

export interface ReworkRecord {
  id: number;
  order_id: number;
  rework_count: number;
  defect_description: string;
  root_cause: string;
  cause_category: string;
  responsible_process: string;
  responsible_person: string;
  correction_action: string;
  correction_date: string;
  created_at: string;
  quality_checks: QualityCheck[];
}

export interface QualityCheck {
  id: number;
  inspector: string;
  check_date: string;
  check_result: string;
  defect_items: string;
  final_conclusion: string;
  created_at: string;
}

export type SeverityLevel = 'low' | 'medium' | 'high';

export interface Anomaly {
  id: number;
  order_id: number;
  anomaly_type: string;
  description: string;
  severity: SeverityLevel;
  reported_by: string;
  reported_date: string;
  status: 'open' | 'resolved';
  resolved_date?: string;
  resolution?: string;
}

export interface OrderHistory {
  id: number;
  order_id: number;
  action: string;
  details: string;
  operator: string;
  created_at: string;
}

export interface StatsSummary {
  total: number;
  pending: number;
  in_progress: number;
  closed: number;
  open_anomalies: number;
  high_rework_orders: ReworkOrder[];
}

export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  in_progress: '返工中',
  closed: '已闭环'
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'warning',
  in_progress: 'danger',
  closed: 'success'
};

export const QC_RESULT_LABELS: Record<string, string> = {
  pass: '合格',
  rework_required: '需返工',
  pending: '待检'
};

export const SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高'
};

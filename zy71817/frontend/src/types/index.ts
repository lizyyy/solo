export interface Transaction {
  id: number;
  transaction_no: string;
  transaction_date: string;
  amount: number;
  fee: number;
  type: string;
  channel: string;
  order_no: string;
  payer: string;
  remark: string;
  is_manual_correction: boolean;
  status: 'pending' | 'pending_confirm' | 'confirmed' | 'void';
  created_at: string;
  current_anomaly?: Anomaly;
}

export interface TransactionDetail extends Transaction {
  status_logs: StatusLog[];
  anomalies: Anomaly[];
  allocations: Allocation[];
}

export interface Anomaly {
  id: number;
  anomaly_type: 'duplicate' | 'cross_period_fee' | 'suspense_refund' | 'late_attachment';
  severity: 'high' | 'warning' | 'info';
  description: string;
  evidence: string;
  related_transaction_ids: string;
  is_resolved: boolean;
  resolution_note?: string;
  created_at: string;
}

export interface StatusLog {
  id: number;
  from_status?: string;
  to_status: string;
  operator: string;
  reason?: string;
  created_at: string;
}

export interface Allocation {
  id: number;
  compensation_no?: string;
  after_sale_order?: string;
  principal_amount: number;
  compensation_amount: number;
  bearer_party?: string;
  is_confirmed: boolean;
}

export interface ReconciliationStats {
  total_count: number;
  total_amount: number;
  confirmed_count: number;
  confirmed_amount: number;
  pending_count: number;
  pending_amount: number;
  anomaly_count: number;
  duplicate_count: number;
  cross_period_fee_count: number;
  suspense_count: number;
}

export const ANOMALY_TYPE_LABELS: Record<string, string> = {
  duplicate: '重复入账',
  cross_period_fee: '手续费跨期',
  suspense_refund: '退款挂账',
  late_attachment: '附件晚到'
};

export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  pending_confirm: '待确认',
  confirmed: '已确认',
  void: '已作废'
};

export const SEVERITY_COLORS: Record<string, string> = {
  high: 'red',
  warning: 'orange',
  info: 'blue'
};

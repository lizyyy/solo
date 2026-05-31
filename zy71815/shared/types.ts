export type SettlementStatus = "pending" | "confirmed" | "withdrawn" | "conflict";
export type OperationType = "import" | "confirm" | "withdraw" | "modify";

export interface SettlementRecord {
  id: string;
  store_name: string;
  activity_name: string;
  settlement_period: string;
  serial_number: string;
  amount: number;
  handling_fee: number;
  handling_fee_period: string;
  status: SettlementStatus;
  dedup_hash: string;
  created_at: string;
  updated_at: string;
}

export interface SettlementFilter {
  store_name?: string;
  activity_name?: string;
  settlement_period_start?: string;
  settlement_period_end?: string;
  status?: SettlementStatus;
  amount_min?: number;
  amount_max?: number;
  page: number;
  page_size: number;
}

export interface SettlementListResponse {
  records: SettlementRecord[];
  total: number;
  page: number;
  page_size: number;
  filter_summary: string;
}

export interface ImportResult {
  session_id: string;
  total: number;
  new_count: number;
  duplicate_count: number;
  conflict_count: number;
  new_records: SettlementRecord[];
  duplicate_records: { record: SettlementRecord; reason: string }[];
  conflict_records: { existing: SettlementRecord; incoming: Partial<SettlementRecord>; diff_fields: string[] }[];
}

export interface WithdrawRequest {
  record_ids: string[];
  reason: string;
}

export interface OperationLog {
  id: string;
  record_id: string;
  operation_type: OperationType;
  operator: string;
  before_value: string | null;
  after_value: string | null;
  reason: string | null;
  created_at: string;
}

export interface BatchRequest {
  record_ids: string[];
  operation: "confirm" | "withdraw";
  reason?: string;
}

export interface BatchResult {
  batch_id: string;
  total: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  details: { record_id: string; status: "success" | "skipped" | "failed"; message: string }[];
}

export interface DashboardStats {
  pending_amount: number;
  pending_count: number;
  cross_period_fee: number;
  cross_period_count: number;
  confirmed_amount: number;
  confirmed_count: number;
  total_amount: number;
  total_count: number;
  recent_imports: ImportSession[];
}

export interface ImportSession {
  id: string;
  file_name: string;
  total_rows: number;
  new_count: number;
  duplicate_count: number;
  conflict_count: number;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

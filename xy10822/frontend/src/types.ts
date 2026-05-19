export type ReconciliationStatus = 
  | 'pending'
  | 'processing'
  | 'matched'
  | 'discrepancy'
  | 'resolved'
  | 'failed'
  | 'exported';

export type DiscrepancyType =
  | 'amount_mismatch'
  | 'missing_internal'
  | 'missing_channel'
  | 'status_mismatch'
  | 'refund_mismatch'
  | 'duplicate'
  | 'other';

export type ActionType =
  | 'import'
  | 'fetch'
  | 'reconcile'
  | 'mark_resolved'
  | 'mark_failed'
  | 'export'
  | 'manual_adjust';

export interface ReconciliationBatch {
  id: number;
  batch_no: string;
  channel: string;
  reconciliation_date: string;
  status: ReconciliationStatus;
  total_channel_count: number;
  total_channel_amount: number;
  total_internal_count: number;
  total_internal_amount: number;
  matched_count: number;
  discrepancy_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Discrepancy {
  id: number;
  batch_id: number;
  discrepancy_type: DiscrepancyType;
  description: string;
  expected_amount?: number;
  actual_amount?: number;
  status: ReconciliationStatus;
  resolved_note?: string;
  resolved_at?: string;
  created_at: string;
}

export interface ProcessingHistory {
  id: number;
  batch_id?: number;
  discrepancy_id?: number;
  action_type: ActionType;
  status: string;
  operator: string;
  details: string;
  error_message?: string;
  created_at: string;
}

export interface BatchStatistics {
  total_batches: number;
  pending_batches: number;
  processing_batches: number;
  matched_batches: number;
  discrepancy_batches: number;
  resolved_batches: number;
  failed_batches: number;
}

export interface DiscrepancyStatistics {
  total_discrepancies: number;
  by_type: Record<string, number>;
}

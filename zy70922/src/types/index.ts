export type SampleStatus = 'pending' | 'matched' | 'mismatch' | 'reviewing' | 'approved' | 'rejected' | 'supplement';
export type ReviewAction = 'approve' | 'reject' | 'supplement';
export type DiscrepancyType = 'mixed_batch' | 'retest_window' | 'report_withdrawn' | 'project_mismatch' | 'value_out_of_range' | 'duplicate_sample' | 'missing_data';

export interface SampleRecord {
  id: string;
  batch_id: string;
  sample_no: string;
  sample_type: string;
  cooperative_id: string;
  cooperative_name: string;
  collection_date: string;
  quantity: number;
  unit: string;
  received_at: string;
  status: SampleStatus;
  raw_data: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionItem {
  id: string;
  sample_no: string;
  batch_id: string;
  item_code: string;
  item_name: string;
  standard_value: string;
  actual_value: string;
  unit: string;
  result: 'pass' | 'fail' | 'pending';
  is_retest: boolean;
  retest_of?: string;
  inspection_date: string;
  inspector: string;
  raw_data: string;
  created_at: string;
}

export interface RetestRule {
  id: string;
  rule_code: string;
  rule_name: string;
  item_code: string;
  fail_threshold: string;
  retest_count: number;
  retest_window_hours: number;
  action_on_fail: 'reject' | 'supplement' | 'review';
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface Discrepancy {
  id: string;
  reconciliation_id: string;
  sample_no: string;
  batch_id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source_field: string;
  expected_value?: string;
  actual_value?: string;
  evidence: string;
  requires_manual_review: boolean;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  resolution_note?: string;
  created_at: string;
}

export interface Reconciliation {
  id: string;
  batch_id: string;
  name: string;
  status: 'draft' | 'processing' | 'completed' | 'archived';
  total_samples: number;
  matched_samples: number;
  mismatched_samples: number;
  pending_samples: number;
  discrepancies_count: number;
  resolved_discrepancies: number;
  csv_import_id?: string;
  json_import_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewRecord {
  id: string;
  reconciliation_id: string;
  sample_no: string;
  discrepancy_id?: string;
  action: ReviewAction;
  reviewer: string;
  comment: string;
  previous_status: string;
  new_status: string;
  created_at: string;
}

export interface ImportRecord {
  id: string;
  type: 'csv' | 'json';
  filename: string;
  file_hash: string;
  record_count: number;
  success_count: number;
  error_count: number;
  errors: string;
  imported_by: string;
  created_at: string;
}

export interface ReportData {
  reconciliation_id: string;
  generated_at: string;
  summary: {
    total_samples: number;
    pass_rate: number;
    discrepancies: number;
    resolved: number;
    pending_review: number;
  };
  samples: Array<{
    sample_no: string;
    status: string;
    items: Array<{
      item_name: string;
      result: string;
      is_retest: boolean;
    }>;
    discrepancies: Array<{
      type: string;
      description: string;
      resolved: boolean;
    }>;
    review_history: Array<{
      action: string;
      reviewer: string;
      comment: string;
      date: string;
    }>;
  }>;
}

export interface ImportHistoryItem {
  id: string;
  batch_label: string | null;
  file_name: string;
  total_rows: number;
  duplicate_rows: number;
  anomaly_count: number;
  operator: string | null;
  created_at: string;
}

export interface ReviewRecord {
  id: string;
  import_id: string;
  original_row_number: number;
  sensor_id: string;
  previous_sensor_id: string | null;
  nameplate_params: string;
  status: 'normal' | 'anomaly' | 'sensor_id_changed';
  current_step: number;
  record_source: 'new' | 'reused' | 'id_changed';
  created_at: string;
  updated_at: string;
}

export interface SensorChange {
  id: string;
  record_id: string;
  import_id: string;
  old_sensor_id: string;
  new_sensor_id: string;
  status: 'pending_review' | 'confirmed' | 'rejected';
  stuck_at_step: number;
  reviewed_by: string | null;
  note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ManualEdit {
  id: string;
  record_id: string;
  import_id: string;
  field: string;
  old_value: string;
  new_value: string;
  edited_by: string;
  created_at: string;
}

export interface BatchData {
  batchInfo: ImportHistoryItem;
  records: ReviewRecord[];
  manualEdits: ManualEdit[];
  sensorChanges: SensorChange[];
}

export interface SelfcheckResult {
  id: string;
  import_id: string;
  check_type: 'duplicate_import' | 'sensor_id_changed' | 'recalc_after_supplement' | 'export_consistency';
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  record_id: string | null;
  import_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  operator: string | null;
  timestamp: string;
  sensor_id?: string;
  previous_sensor_id?: string;
  record_status?: string;
  original_row_number?: number;
}

export interface ExportVerifyResult {
  dataHash: string;
  csvHash: string;
  consistent: boolean;
  recordCount: number;
  error?: boolean;
}

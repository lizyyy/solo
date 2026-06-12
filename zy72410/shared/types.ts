export type MaterialStatus = 'pending' | 'normal' | 'conflict' | 'rework_pending' | 'completed';
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';
export type SelfCheckType = 'duplicate' | 'rework' | 'recalculate' | 'export';
export type SelfCheckSeverity = 'error' | 'warning';

export interface ImportBatch {
  id: string;
  batch_id: string;
  file_name: string;
  total_count: number;
  new_count: number;
  reused_count: number;
  suspected_count: number;
  imported_by: string;
  imported_at: string;
  created_at: string;
}

export interface Material {
  id: string;
  material_name: string;
  isrc_code: string;
  composer: string;
  project_name: string;
  license_start_date: string;
  license_end_date: string;
  episode_count: number;
  license_fee: number;
  revenue_ratio: string;
  error_tolerance: string;
  status: MaterialStatus;
  batch_id: string;
  created_at: string;
  updated_at: string;
}

export interface Track {
  id: string;
  material_id: string;
  track_name: string;
  track_number: number;
  track_type: string;
  isrc_code: string;
  remarks: string;
  need_recheck: boolean;
  rework_confirmed: boolean;
  rework_confirmed_by: string;
  rework_confirmed_at: string;
  created_at: string;
  updated_at: string;
}

export interface TunerMessage {
  id: string;
  material_id: string;
  content: string;
  message_date: string;
  recorded_by: string;
  has_conflict: boolean;
  conflict_status: string;
  created_at: string;
}

export interface Conflict {
  id: string;
  material_id: string;
  track_id: string;
  message_id: string;
  field_name: string;
  original_value: string;
  message_value: string;
  evidence: string | Record<string, any>;
  status: ConflictStatus;
  resolved_by: string;
  resolved_at: string;
  created_at: string;
}

export interface RehearsalChange {
  id: string;
  material_id: string;
  track_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  operator: string;
  change_reason: string;
  affected_items: string[];
  created_at: string;
}

export interface HistoryRecord {
  id: string;
  material_id: string;
  track_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  operator: string;
  change_reason: string;
  record_snapshot: string | Record<string, any>;
  change_id: string;
  created_at: string;
}

export interface ImportPreviewItem {
  temp_id: string;
  material_name: string;
  isrc_code: string;
  license_start_date: string;
  license_end_date: string;
  episode_count: number;
  license_fee: number;
  revenue_ratio: string;
  match_status: 'new' | 'reused' | 'duplicate';
  match_dimensions?: string[];
  existing_id?: string;
}

export interface ImportPreviewResult {
  batch_id: string;
  file_name: string;
  new_items: ImportPreviewItem[];
  reused_items: ImportPreviewItem[];
  suspected_duplicates: ImportPreviewItem[];
  imported_by: string;
  created_at: string;
}

export interface ImportConfirmItem {
  material: Omit<Material, 'id' | 'status' | 'batch_id' | 'created_at' | 'updated_at'>;
  tracks: Array<Omit<Track, 'id' | 'material_id' | 'created_at' | 'updated_at' | 'need_recheck' | 'rework_confirmed' | 'rework_confirmed_by' | 'rework_confirmed_at'>>;
}

export interface ImportConfirmRequest {
  batch_id: string;
  selected_ids: string[];
  action: 'confirm' | 'cancel';
  items: ImportConfirmItem[];
}

export interface SelfCheckIssueDetail {
  id: string;
  description: string;
  location?: string;
  action?: string;
}

export interface SelfCheckResult {
  check_type: SelfCheckType;
  passed: boolean;
  issue_count: number;
  details: SelfCheckIssueDetail[];
  checked_at: string;
}

export interface ReportSummary {
  total_materials: number;
  total_tracks: number;
  pending_conflicts: number;
  tracks_need_recheck: number;
  total_changes: number;
  total_new_imports: number;
  total_reused_imports: number;
  import_batches: Array<{
    batch_id: string;
    file_name: string;
    new_count: number;
    reused_count: number;
    total_count: number;
    imported_by: string;
    created_at: string;
  }>;
  material_change_counts: Record<string, number>;
  generated_at: string;
}

export interface ChangeTraceNode {
  id: string;
  change_type: string;
  field_name: string;
  old_value: string;
  new_value: string;
  operator: string;
  change_reason: string;
  changed_at: string;
  affected_items: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: string;
}

export interface DetectorMatchResult {
  is_duplicate: boolean;
  match_score: number;
  matched_fields: string[];
  existing_material_id?: string;
}

export interface ConflictDetectionResult {
  has_conflict: boolean;
  conflicts: Array<{
    field_name: string;
    original_value: string;
    message_value: string;
    evidence: string[];
  }>;
}

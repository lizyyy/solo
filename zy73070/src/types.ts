export type WorkOrderStatus = 'pending' | 'processing' | 'confirmed' | 'rejected' | 'closed';

export type ConclusionType =
  | 'normal'
  | 'overheat_warning'
  | 'overheat_alarm'
  | 'sensor_fault'
  | 'data_incomplete'
  | 'pending_confirmation'
  | 'false_alarm'
  | 'duplicate_device';

export interface WorkOrder {
  id: string;
  work_order_no: string;
  device_code: string;
  device_name: string | null;
  temperature_value: number | null;
  temperature_threshold: number;
  raw_sensor_log: string | null;
  initial_conclusion: ConclusionType;
  current_conclusion: ConclusionType;
  status: WorkOrderStatus;
  is_suspended: number;
  suspend_reason: string | null;
  is_rescinded: number;
  rescind_reason: string | null;
  rescinded_by: string | null;
  rescinded_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RawSensorLog {
  id: string;
  work_order_id: string;
  raw_content: string;
  source_type: 'manual_import' | 'api_push' | 'file_upload' | 'system_synced';
  source_identifier: string | null;
  received_at: string;
  is_dirty: number;
  dirty_notes: string | null;
}

export interface VerdictHistory {
  id: string;
  work_order_id: string;
  sequence_no: number;
  old_conclusion: ConclusionType | null;
  new_conclusion: ConclusionType;
  change_reason: string;
  operator_id: string;
  operator_name: string;
  supplementary_material: string | null;
  previous_material_snapshot: string | null;
  remark: string | null;
  changed_at: string;
}

export interface DuplicateDeviceAlert {
  id: string;
  work_order_id: string;
  duplicate_device_code: string;
  conflicting_work_order_ids: string;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_type: 'keep_latest' | 'keep_earliest' | 'merge' | 'mark_invalid' | null;
  resolution_note: string | null;
}

export interface AuditLog {
  id: string;
  work_order_id: string | null;
  action_type:
    | 'work_order_created'
    | 'verdict_changed'
    | 'work_order_suspended'
    | 'work_order_resumed'
    | 'work_order_rescinded'
    | 'duplicate_detected'
    | 'duplicate_resolved'
    | 'raw_log_attached'
    | 'material_supplemented';
  actor_id: string;
  actor_name: string;
  old_values: string | null;
  new_values: string | null;
  change_source: 'ui' | 'api' | 'system' | 'batch_job';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateWorkOrderRequest {
  work_order_no: string;
  device_code: string;
  device_name?: string;
  temperature_value?: number;
  temperature_threshold?: number;
  raw_sensor_log?: string;
  initial_conclusion: ConclusionType;
  created_by: string;
  created_by_name: string;
  sensor_sources?: Array<{
    raw_content: string;
    source_type: RawSensorLog['source_type'];
    source_identifier?: string;
    is_dirty?: boolean;
    dirty_notes?: string;
  }>;
}

export interface ChangeVerdictRequest {
  work_order_id: string;
  new_conclusion: ConclusionType;
  change_reason: string;
  operator_id: string;
  operator_name: string;
  supplementary_material?: string;
  remark?: string;
}

export interface SupplementMaterialRequest {
  work_order_id: string;
  supplementary_material: string;
  new_conclusion?: ConclusionType;
  change_reason?: string;
  operator_id: string;
  operator_name: string;
  remark?: string;
}

export interface ResolveDuplicateRequest {
  alert_id: string;
  resolution_type: DuplicateDeviceAlert['resolution_type'];
  resolution_note: string;
  resolved_by: string;
  resolved_by_name: string;
}

export interface RescindWorkOrderRequest {
  work_order_id: string;
  rescind_reason: string;
  rescinded_by: string;
  rescinded_by_name: string;
}

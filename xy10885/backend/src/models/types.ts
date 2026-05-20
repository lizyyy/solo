export interface ExternalSystem {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  config?: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentSlot {
  id: string;
  department_id: string;
  department_name: string;
  external_system_id: string;
  date: string;
  time_slot: string;
  total_count: number;
  available_count: number;
  locked_count: number;
  status: 'available' | 'full' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface LockRecord {
  id: string;
  slot_id: string;
  patient_id: string;
  patient_name: string;
  operator_id?: string;
  operator_name?: string;
  lock_type: 'temporary' | 'permanent';
  status: 'locked' | 'released' | 'confirmed';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReleaseEvent {
  id: string;
  lock_id: string;
  reason: string;
  release_type: 'timeout' | 'manual' | 'cancel' | 'system';
  operator_id?: string;
  operator_name?: string;
  created_at: string;
}

export interface ConflictRecord {
  id: string;
  slot_id: string;
  patient_id: string;
  patient_name: string;
  conflict_type: 'overlock' | 'dup_patient' | 'system_mismatch' | 'data_error';
  description?: string;
  status: 'pending' | 'resolved' | 'ignored';
  resolved_at?: string;
  resolver_id?: string;
  created_at: string;
}

export interface AppointmentVoucher {
  id: string;
  lock_id: string;
  slot_id: string;
  patient_id: string;
  patient_name: string;
  voucher_code: string;
  status: 'valid' | 'used' | 'cancelled' | 'expired';
  check_in_time?: string;
  cancel_time?: string;
  created_at: string;
  updated_at: string;
}

export interface OperationLog {
  id: string;
  operation_type: string;
  entity_type: string;
  entity_id: string;
  operator_id?: string;
  operator_name?: string;
  before_state?: string;
  after_state?: string;
  result: 'success' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

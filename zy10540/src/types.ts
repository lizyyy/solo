export enum RebindStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  EXCEPTION = 'exception',
  MANUAL_FIXED = 'manual_fixed'
}

export interface DeviceRebind {
  id: string;
  device_code: string;
  old_store_id: string;
  old_store_name?: string;
  new_store_id: string;
  new_store_name?: string;
  repair_order_id?: string;
  rebind_reason: string;
  rebind_report?: string;
  status: RebindStatus;
  warranty_valid: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  original_input?: string;
  processing_evidence?: string;
  exception_reason?: string;
}

export interface CreateRebindRequest {
  device_code: string;
  old_store_id: string;
  old_store_name?: string;
  new_store_id: string;
  new_store_name?: string;
  repair_order_id?: string;
  rebind_reason: string;
  rebind_report?: string;
  created_by?: string;
}

export interface QueryRebindRequest {
  device_code?: string;
  old_store_id?: string;
  new_store_id?: string;
  status?: RebindStatus;
  repair_order_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface StatusTransitionRequest {
  rebind_id: string;
  target_status: RebindStatus;
  operated_by?: string;
  remark?: string;
  processing_evidence?: string;
}

export interface ManualFixRequest {
  rebind_id: string;
  device_code?: string;
  old_store_id?: string;
  old_store_name?: string;
  new_store_id?: string;
  new_store_name?: string;
  repair_order_id?: string;
  rebind_reason?: string;
  rebind_report?: string;
  operated_by: string;
  fix_remark: string;
}

export interface RebindHistory {
  id: string;
  rebind_id: string;
  device_code: string;
  old_store_id: string;
  new_store_id: string;
  status: RebindStatus;
  operated_by?: string;
  operated_at: string;
  remark?: string;
}

export const STATUS_TRANSITIONS: Record<RebindStatus, RebindStatus[]> = {
  [RebindStatus.PENDING]: [RebindStatus.REVIEWING, RebindStatus.REJECTED],
  [RebindStatus.REVIEWING]: [RebindStatus.APPROVED, RebindStatus.REJECTED, RebindStatus.EXCEPTION],
  [RebindStatus.APPROVED]: [RebindStatus.COMPLETED, RebindStatus.EXCEPTION],
  [RebindStatus.COMPLETED]: [RebindStatus.MANUAL_FIXED],
  [RebindStatus.REJECTED]: [RebindStatus.PENDING, RebindStatus.MANUAL_FIXED],
  [RebindStatus.EXCEPTION]: [RebindStatus.MANUAL_FIXED, RebindStatus.PENDING],
  [RebindStatus.MANUAL_FIXED]: []
};

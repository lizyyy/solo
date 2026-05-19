export interface PersonInCharge {
  id: number;
  name: string;
  phone: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface PumpRoom {
  id: number;
  name: string;
  location: string;
  building?: string;
  equipment_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionRecord {
  id: number;
  pump_room_id: number;
  inspector_id: number;
  inspection_date: string;
  status: InspectionStatus;
  water_pressure?: number;
  water_equipment_status?: string;
  has_leakage: boolean;
  noise_level?: string;
  remarks?: string;
  exception_type?: string;
  is_needs_repair: boolean;
  created_at: string;
  updated_at: string;
}

export type InspectionStatus = '待处理' | '已报修' | '已完成' | '复测不合格';

export interface RepairRecord {
  id: number;
  inspection_id: number;
  pump_room_id: number;
  reporter_id: number;
  handler_id?: number;
  problem_description: string;
  status: RepairStatus;
  priority: RepairPriority;
  due_date?: string;
  escalated: boolean;
  escalated_at?: string;
  resolved_at?: string;
  resolution?: string;
  retest_failed: boolean;
  retest_remark?: string;
  created_at: string;
  updated_at: string;
}

export type RepairStatus = '待派单' | '处理中' | '待复测' | '已完成' | '已关闭';
export type RepairPriority = '紧急' | '高' | '普通' | '低';

export interface AuditLog {
  id: number;
  operation_type: string;
  record_type: string;
  record_id: number;
  action: string;
  reason?: string;
  passed: boolean;
  operator_id?: number;
  created_at: string;
  details?: string;
}

export interface BatchResult<T> {
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  successful: Array<{ index: number; id: number; data: T }>;
  failed: Array<{ index: number; data: T; error: string }>;
}

export interface QueryFilters {
  inspectorId?: number;
  handlerId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  exceptionType?: string;
  pumpRoomId?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  shouldBlock: boolean;
}

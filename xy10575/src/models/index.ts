export enum EquipmentStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  MAINTENANCE = 'MAINTENANCE',
  ABNORMAL = 'ABNORMAL'
}

export enum CheckType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

export enum ItemType {
  KEY = 'KEY',
  NORMAL = 'NORMAL'
}

export enum InspectionStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXCEPTION = 'EXCEPTION',
  CLOSED = 'CLOSED'
}

export enum ExceptionStatus {
  DETECTED = 'DETECTED',
  DOWNTIME_SCHEDULED = 'DOWNTIME_SCHEDULED',
  MAINTENANCE_ASSIGNED = 'MAINTENANCE_ASSIGNED',
  MAINTENANCE_COMPLETED = 'MAINTENANCE_COMPLETED',
  RECHECK_FAILED = 'RECHECK_FAILED',
  RESOLVED = 'RESOLVED'
}

export enum DowntimeStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum MaintenanceStatus {
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export enum RecheckStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED'
}

export interface Equipment {
  id: string;
  name: string;
  code: string;
  location: string;
  type: string;
  status: EquipmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CheckTemplate {
  id: string;
  equipmentId: string;
  checkType: CheckType;
  name: string;
  description?: string;
  createdAt: string;
}

export interface CheckItem {
  id: string;
  templateId: string;
  name: string;
  itemType: ItemType;
  standard: string;
  method: string;
  sortOrder: number;
  createdAt: string;
}

export interface ShiftInspection {
  id: string;
  idempotentKey?: string;
  equipmentId: string;
  templateId: string;
  shift: string;
  shiftDate: string;
  inspectorId: string;
  inspectorName: string;
  status: InspectionStatus;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionItemResult {
  id: string;
  inspectionId: string;
  itemId: string;
  itemName: string;
  itemType: ItemType;
  standard: string;
  actualValue?: string;
  isNormal: boolean;
  remark?: string;
  checkedAt: string;
  checkedBy: string;
}

export interface ExceptionRecord {
  id: string;
  idempotentKey?: string;
  inspectionId: string;
  itemResultId?: string;
  equipmentId: string;
  itemId?: string;
  itemName?: string;
  itemType?: ItemType;
  description: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reporterId: string;
  reporterName: string;
  status: ExceptionStatus;
  detectedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DowntimeRecord {
  id: string;
  idempotentKey?: string;
  equipmentId: string;
  exceptionId?: string;
  inspectionId?: string;
  reason: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  operatorId: string;
  operatorName: string;
  status: DowntimeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceAssignment {
  id: string;
  idempotentKey?: string;
  exceptionId: string;
  equipmentId: string;
  assigneeId: string;
  assigneeName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  status: MaintenanceStatus;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecheckRecord {
  id: string;
  idempotentKey?: string;
  exceptionId: string;
  inspectionId?: string;
  maintenanceId?: string;
  equipmentId: string;
  recheckerId: string;
  recheckerName: string;
  result: RecheckStatus;
  remark?: string;
  recheckedAt: string;
  createdAt: string;
}

export interface HistoryRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  changes?: string;
  operatorId: string;
  operatorName: string;
  reason?: string;
  timestamp: string;
}

export interface AppResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

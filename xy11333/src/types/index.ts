export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'timeout';

export type TaskPriority = 'normal' | 'urgent' | 'emergency';

export type RecordSource = 'csv_import' | 'json_import' | 'manual' | 'system';

export type ErrorType = 'validation' | 'import' | 'business' | 'system';

export type PermissionLevel = 'admin' | 'manager' | 'staff' | 'guest';

export interface Escort {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  department: string;
  status: 'on_duty' | 'off_duty' | 'break' | 'busy';
  shiftStart: string;
  shiftEnd: string;
  currentTaskCount: number;
  maxTaskCount: number;
  skills: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Appointment {
  id: string;
  appointmentNo: string;
  patientName: string;
  patientId: string;
  patientPhone: string;
  department: string;
  examType: string;
  examLocation: string;
  scheduledTime: number;
  estimatedDuration: number;
  status: 'scheduled' | 'arrived' | 'in_exam' | 'completed' | 'cancelled';
  notes: string;
  source: RecordSource;
  importBatchId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EscortTask {
  id: string;
  taskNo: string;
  appointmentId: string;
  escortId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  patientName: string;
  patientId: string;
  examType: string;
  examLocation: string;
  scheduledTime: number;
  assignedAt?: number;
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  timeoutAt?: number;
  waitDuration?: number;
  actualDuration?: number;
  isInserted: boolean;
  insertReason?: string;
  cancelReason?: string;
  timeoutReason?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ImportRecord {
  id: string;
  batchId: string;
  sourceType: 'csv' | 'json';
  fileName: string;
  recordType: 'appointment' | 'escort';
  originalIndex: number;
  rawData: string;
  status: 'success' | 'failed' | 'warning';
  errors: ImportError[];
  recordId?: string;
  importedAt: number;
}

export interface ImportError {
  field: string;
  errorCode: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning';
}

export interface HistoryRecord {
  id: string;
  entityType: 'task' | 'appointment' | 'escort';
  entityId: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  operator: string;
  operatorLevel: PermissionLevel;
  ipAddress?: string;
  reason?: string;
  timestamp: number;
}

export interface ErrorLog {
  id: string;
  errorType: ErrorType;
  errorCode: string;
  message: string;
  stack?: string;
  context: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  createdAt: number;
}

export interface DataMaskingConfig {
  fields: MaskingField[];
}

export interface MaskingField {
  entity: string;
  field: string;
  maskType: 'phone' | 'idcard' | 'name' | 'email' | 'custom';
  minLevel: PermissionLevel;
  pattern?: string;
}

export enum AppointmentStatus {
  PENDING_CONFIRM = 'pending_confirm',
  LOCKED = 'locked',
  REBUILDING = 'rebuilding',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  MANUAL_REVIEW = 'manual_review'
}

export enum FlowType {
  NORMAL = 'normal',
  REJECT = 'reject',
  MANUAL_REVIEW = 'manual_review'
}

export enum ErrorCode {
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  INVALID_INDEX_NAME = 'INVALID_INDEX_NAME',
  INVALID_DATA_SIZE = 'INVALID_DATA_SIZE',
  INVALID_TIME_WINDOW = 'INVALID_TIME_WINDOW',
  CONFLICT_DETECTED = 'CONFLICT_DETECTED',
  APPOINTMENT_NOT_FOUND = 'APPOINTMENT_NOT_FOUND',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  IMPORT_BAD_ROW = 'IMPORT_BAD_ROW',
  MANUAL_INTERVENTION_REQUIRED = 'MANUAL_INTERVENTION_REQUIRED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Appointment {
  id: string;
  indexName: string;
  dataSize: number;
  timeWindow: TimeWindow;
  impactScope: string[];
  status: AppointmentStatus;
  flowType: FlowType;
  isLargeIndex: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  remark?: string;
  rejectReason?: string;
}

export interface AppointmentHistory {
  id: string;
  appointmentId: string;
  fromStatus?: AppointmentStatus;
  toStatus: AppointmentStatus;
  flowType: FlowType;
  operator: string;
  remark?: string;
  createdAt: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictAppointments?: Appointment[];
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  badRows: Array<{
    row: number;
    data: any;
    reason: string;
  }>;
  appointments: Appointment[];
}

export const LARGE_INDEX_THRESHOLD = 100000000;
export const LOW_PEAK_WINDOWS = [
  { start: '00:00', end: '04:00' },
  { start: '01:00', end: '05:00' }
];

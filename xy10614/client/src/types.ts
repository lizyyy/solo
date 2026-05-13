export enum VisitorStatus {
  PENDING_HOST_CONFIRM = 'pending_host_confirm',
  HOST_CONFIRMED = 'host_confirmed',
  HOST_REJECTED = 'host_rejected',
  PLATE_ENTERED = 'plate_entered',
  PLATE_REJECTED = 'plate_rejected',
  QRCODE_SCANNED = 'qrcode_scanned',
  CHECKED_OUT = 'checked_out',
  BLOCKED = 'blocked',
  MANUAL_REVIEW = 'manual_review',
  COMPLETED = 'completed'
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  CONFIRM = 'confirm',
  REJECT = 'reject',
  CHECK_IN = 'check_in',
  CHECK_OUT = 'check_out',
  MANUAL_REVIEW = 'manual_review',
  BLACKLIST_ADD = 'blacklist_add',
  BLACKLIST_REMOVE = 'blacklist_remove'
}

export interface VisitorRecord {
  id: string;
  visitorName: string;
  visitorPhone: string;
  visitorIdCard?: string;
  visitorPlate?: string;
  visitorCompany?: string;
  hostName: string;
  hostPhone: string;
  hostDepartment: string;
  visitReason: string;
  expectedVisitDate: string;
  expectedVisitTime: string;
  status: VisitorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  time: string;
  event: string;
  operator?: string;
  details?: string;
}

export interface OperationLog {
  id: string;
  visitorId?: string;
  operationType: OperationType;
  operator: string;
  operatorRole: string;
  description: string;
  beforeValue?: any;
  afterValue?: any;
  createdAt: string;
}

export interface ExportFilter {
  operator?: string;
  startTime?: string;
  endTime?: string;
  visitorId?: string;
  operationType?: OperationType;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

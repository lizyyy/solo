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

export interface HostConfirmation {
  id: string;
  visitorId: string;
  confirmed: boolean;
  confirmTime?: string;
  rejectReason?: string;
  operator: string;
  createdAt: string;
  previousValue?: Partial<HostConfirmation>;
}

export interface PlateEntry {
  id: string;
  visitorId: string;
  plateNumber: string;
  entryTime?: string;
  exitTime?: string;
  verified: boolean;
  rejectReason?: string;
  operator: string;
  createdAt: string;
  previousValue?: Partial<PlateEntry>;
}

export interface AccessQRCode {
  id: string;
  visitorId: string;
  qrcode: string;
  scanned: boolean;
  scanTime?: string;
  expireTime: string;
  operator: string;
  createdAt: string;
  previousValue?: Partial<AccessQRCode>;
}

export interface CheckoutRecord {
  id: string;
  visitorId: string;
  checkoutTime: string;
  checkoutType: 'auto' | 'manual';
  operator?: string;
  blocked: boolean;
  blockReason?: string;
  createdAt: string;
}

export interface BlacklistRecord {
  id: string;
  visitorName: string;
  visitorPhone: string;
  visitorIdCard?: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  removedBy?: string;
  removedAt?: string;
  isActive: boolean;
  affectedRecords: string[];
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

export interface SecurityReport {
  id: string;
  reportDate: string;
  totalVisitors: number;
  completedVisits: number;
  blockedVisits: number;
  manualReviews: number;
  blacklistCount: number;
  abnormalRecords: string[];
  generatedBy: string;
  generatedAt: string;
}

export interface TimelineEvent {
  time: string;
  event: string;
  operator?: string;
  details?: string;
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

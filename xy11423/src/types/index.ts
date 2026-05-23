export enum BatchStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PARTIAL_SUCCESS = 'partial_success',
  SUCCESS = 'success',
  RECALLED = 'recalled',
  MANUAL_REVIEW = 'manual_review',
  FROZEN = 'frozen',
  EXPORTED = 'exported',
  FAILED = 'failed'
}

export enum IdempotentStrategy {
  IGNORE = 'ignore',
  OVERWRITE = 'overwrite',
  APPEND = 'append'
}

export enum AuditAction {
  BATCH_CREATED = 'batch_created',
  BATCH_SUBMITTED = 'batch_submitted',
  BATCH_RECALLED = 'batch_recalled',
  BATCH_RE_SUBMITTED = 'batch_re_submitted',
  BATCH_FROZEN = 'batch_frozen',
  BATCH_UNFROZEN = 'batch_unfrozen',
  BATCH_EXPORTED = 'batch_exported',
  MANUAL_JUDGMENT = 'manual_judgment',
  ITEM_UPDATED = 'item_updated',
  ITEM_DELETED = 'item_deleted',
  STATUS_CHANGED = 'status_changed'
}

export interface Batch {
  id: string;
  batchNo: string;
  vin: string;
  plateNumber: string;
  responsiblePerson: string;
  status: BatchStatus;
  idempotentStrategy: IdempotentStrategy;
  frozen: boolean;
  frozenAt: number | null;
  frozenBy: string | null;
  submitCount: number;
  lastSubmittedAt: number | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface InspectionSheet {
  id: string;
  batchId: string;
  sheetNo: string;
  inspector: string;
  inspectionDate: number;
  mileage: number;
  overallStatus: string;
  items: string;
  remarks: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface RepairQuote {
  id: string;
  batchId: string;
  quoteNo: string;
  workshop: string;
  quotedBy: string;
  quoteDate: number;
  totalAmount: number;
  items: string;
  laborCost: number;
  partsCost: number;
  remarks: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface PhotoItem {
  id: string;
  batchId: string;
  photoNo: string;
  category: string;
  name: string;
  url: string;
  thumbnail: string | null;
  uploadedBy: string;
  uploadedAt: number;
  isAbnormal: boolean;
  abnormalDesc: string | null;
  status: string;
  createdAt: number;
}

export interface AbnormalPhoto {
  id: string;
  batchId: string;
  photoItemId: string;
  abnormalType: string;
  description: string;
  severity: string;
  reportedBy: string;
  reportedAt: number;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: number | null;
  reviewResult: string | null;
  manualOverride: boolean;
  manualOverrideBy: string | null;
  manualOverrideAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SmsScreenshot {
  id: string;
  batchId: string;
  smsNo: string;
  sender: string;
  receiver: string;
  content: string;
  sentAt: number;
  url: string;
  uploadedBy: string;
  uploadedAt: number;
  status: string;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  batchId: string | null;
  itemType: string | null;
  itemId: string | null;
  action: AuditAction;
  oldValue: string | null;
  newValue: string | null;
  operator: string;
  operatorRole: string;
  ipAddress: string | null;
  userAgent: string | null;
  remark: string | null;
  createdAt: number;
}

export interface StatusTransition {
  id: string;
  batchId: string;
  fromStatus: BatchStatus | null;
  toStatus: BatchStatus;
  reason: string;
  operator: string;
  createdAt: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  traceId: string;
  timestamp: number;
}

export interface BatchSubmitRequest {
  batchNo: string;
  vin: string;
  plateNumber: string;
  responsiblePerson: string;
  strategy: IdempotentStrategy;
  inspectionSheets: Omit<InspectionSheet, 'id' | 'batchId' | 'status' | 'createdAt' | 'updatedAt'>[];
  repairQuotes: Omit<RepairQuote, 'id' | 'batchId' | 'status' | 'createdAt' | 'updatedAt'>[];
  photoItems: Omit<PhotoItem, 'id' | 'batchId' | 'status' | 'createdAt'>[];
  smsScreenshots: Omit<SmsScreenshot, 'id' | 'batchId' | 'status' | 'createdAt'>[];
  operator: string;
  operatorRole: string;
}

export interface SubmitResult {
  batchId: string;
  batchNo: string;
  status: BatchStatus;
  strategyApplied: IdempotentStrategy;
  totalItems: number;
  successItems: number;
  failedItems: number;
  errors: SubmitError[];
  isRetry: boolean;
}

export interface SubmitError {
  type: string;
  index: number;
  field: string;
  message: string;
  value: any;
}

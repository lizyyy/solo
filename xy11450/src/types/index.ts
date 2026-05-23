export enum ReturnStatus {
  BATCH_CREATED = 'BATCH_CREATED',
  ATTACHMENTS_PENDING = 'ATTACHMENTS_PENDING',
  ATTACHMENTS_COMPLETE = 'ATTACHMENTS_COMPLETE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REVIEW_APPROVED = 'REVIEW_APPROVED',
  REVIEW_REJECTED = 'REVIEW_REJECTED',
  SETTLEMENT_FROZEN = 'SETTLEMENT_FROZEN',
  SETTLEMENT_COMPLETED = 'SETTLEMENT_COMPLETED',
  RETURNED = 'RETURNED',
  ARCHIVED = 'ARCHIVED'
}

export enum AttachmentType {
  OUTBOUND_ORDER = 'OUTBOUND_ORDER',
  RETURN_PHOTO = 'RETURN_PHOTO',
  MAINTENANCE_ESTIMATE = 'MAINTENANCE_ESTIMATE',
  REFUND_RECEIPT = 'REFUND_RECEIPT',
  INVENTORY_REPORT = 'INVENTORY_REPORT'
}

export enum AuditAction {
  STATUS_CHANGE = 'STATUS_CHANGE',
  ATTACHMENT_UPLOAD = 'ATTACHMENT_UPLOAD',
  ATTACHMENT_DELETE = 'ATTACHMENT_DELETE',
  MANUAL_EDIT = 'MANUAL_EDIT',
  FREEZE = 'FREEZE',
  UNFREEZE = 'UNFREEZE',
  ARCHIVE = 'ARCHIVE',
  UNARCHIVE = 'UNARCHIVE'
}

export interface ReturnBatch {
  id: string;
  batchNo: string;
  customerId: string;
  customerName: string;
  orderId: string;
  equipmentList?: EquipmentItem[];
  totalDeposit: number;
  deductibleAmount: number;
  finalRefund: number;
  status: ReturnStatus;
  previousStatus?: ReturnStatus;
  freezeReason?: string;
  frozenBy?: string;
  frozenAt?: Date;
  manualReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  isArchived?: boolean;
  archivedAt?: Date;
  archivedBy?: string;
}

export interface EquipmentItem {
  id: string;
  batchId: string;
  equipmentCode: string;
  equipmentName: string;
  expectedReturnDate: Date;
  actualReturnDate?: Date;
  depositAmount: number;
  deductibleAmount: number;
  condition: 'EXCELLENT' | 'GOOD' | 'DAMAGED' | 'LOST';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  batchId: string;
  type: AttachmentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
  isVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
}

export interface AuditLog {
  id: string;
  batchId: string;
  action: AuditAction;
  previousValue?: any;
  newValue?: any;
  reason: string;
  operatorId: string;
  operatorName: string;
  timestamp: Date;
  ipAddress?: string;
}

export interface FailedRecord {
  id: string;
  batchId: string;
  failureType: 'VALIDATION_ERROR' | 'DATA_INCONSISTENCY' | 'CALCULATION_ERROR' | 'EXPORT_ERROR';
  errorMessage: string;
  errorDetails?: any;
  sourceData: any;
  failedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface DepositDeduction {
  id: string;
  batchId: string;
  equipmentId: string;
  deductionType: 'DAMAGE' | 'MISSING_PARTS' | 'LATE_RETURN' | 'OTHER';
  amount: number;
  reason: string;
  evidenceAttachmentIds: string[];
  createdBy: string;
  createdAt: Date;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  traceId?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FinancialSummary {
  totalBatches: number;
  totalDeposit: number;
  totalDeductions: number;
  totalRefunds: number;
  frozenAmount: number;
  pendingReviewAmount: number;
  byStatus: Record<ReturnStatus, { count: number; amount: number }>;
}

export enum LockStatus {
  LOCKED = 'LOCKED',
  RELEASING = 'RELEASING',
  PARTIALLY_RELEASED = 'PARTIALLY_RELEASED',
  RELEASED = 'RELEASED',
  FAILED = 'FAILED',
}

export enum ReleaseCondition {
  ACTIVITY_CANCEL = 'ACTIVITY_CANCEL',
  ACTIVITY_END = 'ACTIVITY_END',
  MANUAL_TRIGGER = 'MANUAL_TRIGGER',
  TIMEOUT = 'TIMEOUT',
}

export enum ExceptionType {
  SKU_NOT_FOUND = 'SKU_NOT_FOUND',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  DUPLICATE_RELEASE = 'DUPLICATE_RELEASE',
  INVALID_STATUS = 'INVALID_STATUS',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

export interface ActivityStockLock {
  id: string;
  activityId: string;
  sku: string;
  skuName?: string;
  lockQuantity: number;
  releasedQuantity: number;
  status: LockStatus;
  releaseCondition: ReleaseCondition;
  operator?: string;
  createdAt: Date;
  updatedAt: Date;
  lockTime: Date;
  expectedReleaseTime?: Date;
}

export interface ReleaseRecord {
  id: string;
  lockId: string;
  activityId: string;
  sku: string;
  releaseQuantity: number;
  releasedBy?: string;
  releasedAt: Date;
  releaseCondition: ReleaseCondition;
  isIdempotent: boolean;
  requestId: string;
}

export interface ExceptionDetail {
  id: string;
  lockId?: string;
  activityId: string;
  sku?: string;
  exceptionType: ExceptionType;
  errorMessage: string;
  originalInput: Record<string, any>;
  processingBasis: string;
  operator?: string;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

export interface ReleaseReport {
  id: string;
  reportId: string;
  activityId: string;
  generatedAt: Date;
  generatedBy?: string;
  totalSkus: number;
  totalLockedQuantity: number;
  totalReleasedQuantity: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  details: ReportDetail[];
}

export interface ReportDetail {
  sku: string;
  skuName?: string;
  lockQuantity: number;
  releasedQuantity: number;
  status: string;
  lastReleaseTime?: Date;
  exceptionMessage?: string;
}

export interface CreateLockRequest {
  activityId: string;
  skuItems: Array<{
    sku: string;
    skuName?: string;
    quantity: number;
  }>;
  releaseCondition: ReleaseCondition;
  expectedReleaseTime?: string;
  operator?: string;
}

export interface QueryLocksRequest {
  activityId?: string;
  sku?: string;
  status?: LockStatus;
  page?: number;
  pageSize?: number;
}

export interface AdvanceStatusRequest {
  activityId: string;
  skus?: string[];
  releaseCondition: ReleaseCondition;
  operator?: string;
  requestId: string;
}

export interface ManualCorrectionRequest {
  lockId: string;
  newStatus?: LockStatus;
  adjustQuantity?: number;
  correctionReason: string;
  operator: string;
}

export interface ResolveExceptionRequest {
  exceptionId: string;
  resolution: string;
  operator: string;
}

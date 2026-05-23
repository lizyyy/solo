export enum SourceType {
  RECEIPT = 'receipt',
  PURCHASE_ARRIVAL = 'purchase_arrival',
  TEACHER_SIGN = 'teacher_sign',
  SUPERVISOR_COMMENT = 'supervisor_comment',
  GROUP_BORROW = 'group_borrow',
  LOSS_RECORD = 'loss_record',
}

export enum QueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
  MANUAL_REVIEW = 'manual_review',
  DEAD_LETTER = 'dead_letter',
  CANCELLED = 'cancelled',
  FROZEN = 'frozen',
  CLOSED = 'closed',
}

export enum RetryStrategy {
  IGNORE = 'ignore',
  OVERWRITE = 'overwrite',
  APPEND = 'append',
}

export enum OperationType {
  SUBMIT = 'submit',
  RETRY = 'retry',
  MANUAL_DECISION = 'manual_decision',
  COMPENSATE = 'compensate',
  CANCEL = 'cancel',
  FREEZE = 'freeze',
  UNFREEZE = 'unfreeze',
  CLOSE = 'close',
  COMMENT = 'comment',
  RESUBMIT = 'resubmit',
}

export interface BaseRecord {
  id: string;
  sourceType: SourceType;
  batchId: string;
  sourceId: string;
  data: Record<string, any>;
  submittedBy: string;
  submittedAt: number;
}

export interface QueueItem {
  id: string;
  recordId: string;
  sourceType: SourceType;
  batchId: string;
  status: QueueStatus;
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: number;
  nextRetryAt?: number;
  processedBy?: string;
  processedAt?: number;
  errorMessage?: string;
  errorStack?: string;
  frozen: boolean;
  frozenBy?: string;
  frozenAt?: number;
  frozenReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChangeHistory {
  id: string;
  queueItemId: string;
  operationType: OperationType;
  operator: string;
  operatedAt: number;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  diff?: Record<string, any>;
  comment?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeadLetter {
  id: string;
  queueItemId: string;
  recordId: string;
  sourceType: SourceType;
  batchId: string;
  originalError: string;
  retryHistory: Array<{
    attempt: number;
    error: string;
    at: number;
  }>;
  receivedAt: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
  resolution?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  traceId?: string;
}

export interface SubmitRequest {
  sourceType: SourceType;
  batchId: string;
  items: Array<{
    sourceId: string;
    data: Record<string, any>;
  }>;
  submittedBy: string;
  retryStrategy?: RetryStrategy;
  comment?: string;
}

export interface RetryRequest {
  queueItemIds: string[];
  operator: string;
  comment?: string;
  force?: boolean;
}

export interface ManualDecisionRequest {
  queueItemId: string;
  decision: 'approve' | 'reject' | 'retry' | 'dead_letter';
  operator: string;
  comment: string;
  overrideData?: Record<string, any>;
}

export interface ExportRequest {
  format: 'csv' | 'json';
  filters?: {
    sourceType?: SourceType[];
    status?: QueueStatus[];
    batchId?: string;
    startDate?: number;
    endDate?: number;
  };
  includeHistory?: boolean;
  includeDeadLetter?: boolean;
}

export interface AuditCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface RetryClassification {
  category: string;
  count: number;
  items: Array<{
    id: string;
    sourceType: SourceType;
    error: string;
    lastAttempt: number;
  }>;
}

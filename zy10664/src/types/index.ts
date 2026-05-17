export enum TaskStatus {
  RUNNING = 'RUNNING',
  FUSED = 'FUSED',
  RECOVERY_APPLY = 'RECOVERY_APPLY',
  RECOVERED = 'RECOVERED'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  FUSE = 'FUSE',
  APPLY_RECOVERY = 'APPLY_RECOVERY',
  APPROVE_RECOVERY = 'APPROVE_RECOVERY',
  REJECT_RECOVERY = 'REJECT_RECOVERY',
  WITHDRAW = 'WITHDRAW',
  RECOVER = 'RECOVER',
  MANUAL_REMARK = 'MANUAL_REMARK'
}

export interface RecoveryCondition {
  id: string;
  taskId: string;
  type: 'FIX_ERROR' | 'DATA_CLEAN' | 'DEPENDENCY_READY' | 'OTHER';
  description: string;
  isMet: boolean;
  metAt?: Date;
  metBy?: string;
  createdAt: Date;
}

export interface FailureRecord {
  id: string;
  taskId: string;
  failureTime: Date;
  errorMessage: string;
  errorStack?: string;
  retryCount: number;
  isInQueue: boolean;
  isProcessed: boolean;
}

export interface AuditHistory {
  id: string;
  taskId: string;
  action: AuditAction;
  operator: string;
  remark?: string;
  oldStatus?: TaskStatus;
  newStatus?: TaskStatus;
  createdAt: Date;
}

export interface Task {
  id: string;
  taskName: string;
  taskCode: string;
  schedulerName: string;
  status: TaskStatus;
  failureCount: number;
  fuseReason?: string;
  fusedAt?: Date;
  recoveryApplyAt?: Date;
  recoveredAt?: Date;
  recoveryApplicant?: string;
  recoveryAuditor?: string;
  recoveryRemark?: string;
  manualRemark?: string;
  hasQueuedRetry: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskRequest {
  taskName: string;
  taskCode: string;
  schedulerName: string;
}

export interface UpdateTaskRequest {
  taskName?: string;
  schedulerName?: string;
}

export interface ApplyRecoveryRequest {
  applicant: string;
  recoveryRemark: string;
  recoveryConditions: Array<{
    type: RecoveryCondition['type'];
    description: string;
  }>;
}

export interface AuditRecoveryRequest {
  auditor: string;
  approved: boolean;
  auditRemark?: string;
}

export interface WithdrawRequest {
  operator: string;
  reason: string;
}

export interface ManualRemarkRequest {
  operator: string;
  remark: string;
}

export interface RecordFailureRequest {
  errorMessage: string;
  errorStack?: string;
  retryCount: number;
}

export interface TaskQuery {
  status?: TaskStatus;
  taskCode?: string;
  schedulerName?: string;
  page?: number;
  pageSize?: number;
}

export interface TaskDetailResponse extends Task {
  recoveryConditions: RecoveryCondition[];
  failureRecords: FailureRecord[];
  auditHistories: AuditHistory[];
}

export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  message?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    data: any;
    errors: ValidationError[];
  }>;
  conflicts: Array<{
    row: number;
    data: any;
    existingTaskId: string;
    message: string;
  }>;
}

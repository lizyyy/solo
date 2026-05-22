export enum BatchStatus {
  PENDING_SUBMIT = 'pending_submit',
  PROCESSING = 'processing',
  PENDING_REVIEW = 'pending_review',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  FROZEN = 'frozen',
  SETTLED = 'settled',
  ARCHIVED = 'archived',
  WITHDRAWN = 'withdrawn'
}

export enum Role {
  CUSTOMER_SERVICE = 'customer_service',
  TECHNICIAN = 'technician',
  REVIEWER = 'reviewer',
  PROJECT_MANAGER = 'project_manager',
  FINANCE = 'finance'
}

export interface Batch {
  id: string;
  batchNo: string;
  version: number;
  parentBatchId?: string;
  status: BatchStatus;
  title: string;
  remark: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  frozenAt?: string;
  frozenBy?: string;
  frozenByName?: string;
  statusBeforeFreeze?: BatchStatus;
}

export interface RawDataRecord {
  id: string;
  batchId: string;
  sourceFile: string;
  originalRowNumber: number;
  originalValue: string;
  parsedValue: string;
  fieldName: string;
  createdAt: string;
}

export interface StatusTransition {
  id: string;
  batchId: string;
  fromStatus: BatchStatus;
  toStatus: BatchStatus;
  transitionType: 'auto' | 'manual';
  reason?: string;
  operatedBy: string;
  operatedByName?: string;
  operatedAt: string;
  ipAddress: string;
}

export interface ReviewRecord {
  id: string;
  batchId: string;
  originalStatus: BatchStatus;
  newStatus: BatchStatus;
  reason: string;
  reviewedBy: string;
  reviewedByName?: string;
  reviewedAt: string;
  evidence?: string[];
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  batchId: string;
  fileName: string;
  fileType: 'image' | 'excel' | 'pdf' | 'other';
  fileSize: number;
  storagePath: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
  version: number;
}

export interface User {
  id: string;
  username: string;
  role: Role;
  realName: string;
  createdAt: string;
  lastLogin?: string;
}

export interface CreateBatchRequest {
  title: string;
  remark: string;
}

export interface CreateBatchResponse {
  success: boolean;
  batchId: string;
  batchNo: string;
  parsedRecords: number;
  failedRecords: {
    rowNumber: number;
    reason: string;
    originalValue: string;
  }[];
}

export interface ReviewRequest {
  batchId: string;
  action: 'approve' | 'reject';
  reason: string;
  evidenceAttachments?: string[];
}

export interface ReviewResponse {
  success: boolean;
  batchId: string;
  previousStatus: BatchStatus;
  newStatus: BatchStatus;
  reviewRecordId: string;
}

export interface PermissionDeniedResponse {
  success: boolean;
  error: string;
  errorCode: 'PERMISSION_DENIED';
  message: string;
  requiredRole: Role;
  userRole: Role;
  auditLogId: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface BatchDetailResponse {
  batch: Batch;
  rawData: RawDataRecord[];
  transitions: StatusTransition[];
  reviewRecords: ReviewRecord[];
  attachments: Attachment[];
}

export interface ReportSummary {
  totalBatches: number;
  statusCounts: Record<BatchStatus, number>;
  frozenBeforeStatus: Record<BatchStatus, number>;
  reviewReasons: { reason: string; count: number }[];
  permissionDeniedCount: number;
  avgProcessingTime: number;
}

export const BatchStatusLabel: Record<BatchStatus, string> = {
  [BatchStatus.PENDING_SUBMIT]: '待提交',
  [BatchStatus.PROCESSING]: '处理中',
  [BatchStatus.PENDING_REVIEW]: '待复核',
  [BatchStatus.REVIEW_APPROVED]: '复核通过',
  [BatchStatus.REVIEW_REJECTED]: '复核驳回',
  [BatchStatus.FROZEN]: '已冻结',
  [BatchStatus.SETTLED]: '已结算',
  [BatchStatus.ARCHIVED]: '已归档',
  [BatchStatus.WITHDRAWN]: '已撤回'
};

export const RoleLabel: Record<Role, string> = {
  [Role.CUSTOMER_SERVICE]: '物业客服',
  [Role.TECHNICIAN]: '维修师傅',
  [Role.REVIEWER]: '复核专员',
  [Role.PROJECT_MANAGER]: '项目经理',
  [Role.FINANCE]: '财务人员'
};

export const rolePermissions: Record<Role, string[]> = {
  [Role.CUSTOMER_SERVICE]: [
    'batch:create',
    'batch:submit',
    'batch:withdraw',
    'batch:attach',
    'batch:view',
    'batch:list'
  ],
  [Role.TECHNICIAN]: [
    'batch:view',
    'batch:receipt'
  ],
  [Role.REVIEWER]: [
    'batch:view',
    'batch:list',
    'review:approve',
    'review:reject'
  ],
  [Role.PROJECT_MANAGER]: [
    'batch:view',
    'batch:list',
    'settlement:freeze',
    'settlement:unfreeze',
    'audit:view',
    'report:view',
    'report:export'
  ],
  [Role.FINANCE]: [
    'batch:view',
    'batch:list',
    'settlement:settle',
    'audit:view'
  ]
};

export enum BatchStatus {
  CREATED = 'CREATED',
  VALIDATING = 'VALIDATING',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  READY = 'READY',
  CONSUMING = 'CONSUMING',
  PARTIAL_CONSUMED = 'PARTIAL_CONSUMED',
  CONSUMED = 'CONSUMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum NodeStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
  CONSUMED = 'CONSUMED',
  FAILED = 'FAILED'
}

export enum ConsumerStatus {
  PENDING = 'PENDING',
  CONSUMING = 'CONSUMING',
  CONSUMED = 'CONSUMED',
  FAILED = 'FAILED',
  ACKNOWLEDGED = 'ACKNOWLEDGED'
}

export interface SyncBatch {
  id: string;
  source: string;
  totalNodes: number;
  validNodes: number;
  invalidNodes: number;
  status: BatchStatus;
  rawInput: string;
  validationReport?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  createdBy: string;
}

export interface DepartmentNode {
  id: string;
  batchId: string;
  deptId: string;
  deptName: string;
  parentDeptId: string | null;
  level: number;
  sortOrder: number;
  status: NodeStatus;
  rawData: string;
  createdAt: number;
  updatedAt: number;
}

export interface DepartmentRelation {
  id: string;
  batchId: string;
  ancestorDeptId: string;
  descendantDeptId: string;
  distance: number;
  createdAt: number;
}

export interface ConsumerSystem {
  id: string;
  name: string;
  description?: string;
  callbackUrl?: string;
  createdAt: number;
  isActive: boolean;
}

export interface ConsumerProgress {
  id: string;
  batchId: string;
  consumerId: string;
  status: ConsumerStatus;
  consumedCount: number;
  lastConsumedNodeId?: string;
  errorMessage?: string;
  ackAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExceptionNode {
  id: string;
  batchId: string;
  nodeId: string;
  deptId: string;
  errorType: string;
  errorMessage: string;
  rawInput: string;
  processingBasis: string;
  resolution?: string;
  isResolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  createdAt: number;
}

export interface SyncReport {
  id: string;
  batchId: string;
  reportType: string;
  content: string;
  generatedAt: number;
  generatedBy: string;
}

export interface CreateBatchRequest {
  source: string;
  departments: Array<{
    deptId: string;
    deptName: string;
    parentDeptId: string | null;
    sortOrder?: number;
    [key: string]: any;
  }>;
  createdBy: string;
}

export interface ManualFixRequest {
  nodeId: string;
  fixes: {
    deptName?: string;
    parentDeptId?: string | null;
    sortOrder?: number;
  };
  operator: string;
  remark: string;
}

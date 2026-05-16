export enum BatchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export enum KeyStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  RETRYING = 'retrying'
}

export enum NodeStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
  IDLE = 'idle'
}

export enum RetryStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed'
}

export interface DataSource {
  id: string;
  name: string;
  type: 'mysql' | 'redis' | 'api' | 'file' | 'other';
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionNode {
  id: string;
  name: string;
  ip: string;
  status: NodeStatus;
  currentBatchId?: string;
  lastHeartbeat: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarmupBatch {
  id: string;
  name: string;
  description?: string;
  status: BatchStatus;
  totalKeys: number;
  successKeys: number;
  failedKeys: number;
  pendingKeys: number;
  dataSourceId: string;
  assignedNodeId?: string;
  priority: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CacheKey {
  id: string;
  batchId: string;
  cacheKey: string;
  cacheType: string;
  ttl?: number;
  status: KeyStatus;
  dataSourceId: string;
  dataQuery: string;
  assignedNodeId?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FailureRecord {
  id: string;
  cacheKeyId: string;
  batchId: string;
  originalInput: string;
  processingBasis: string;
  errorMessage: string;
  errorStack?: string;
  finalConclusion: string;
  nodeId?: string;
  occurredAt: Date;
  createdAt: Date;
}

export interface RetryRecord {
  id: string;
  cacheKeyId: string;
  batchId: string;
  retryAttempt: number;
  status: RetryStatus;
  nodeId?: string;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarmupReport {
  batchId: string;
  batchName: string;
  status: BatchStatus;
  totalKeys: number;
  successKeys: number;
  failedKeys: number;
  pendingKeys: number;
  successRate: number;
  duration?: number;
  startedAt?: Date;
  completedAt?: Date;
  failureDetails: FailureRecord[];
}

export interface CreateBatchRequest {
  name: string;
  description?: string;
  dataSourceId: string;
  cacheKeys: Array<{
    key: string;
    type: string;
    ttl?: number;
    dataQuery: string;
  }>;
  priority?: number;
  scheduledAt?: Date;
  maxRetries?: number;
  createdBy: string;
}

export interface UpdateStatusRequest {
  status: BatchStatus;
  updatedBy: string;
}

export interface KeyResultRequest {
  cacheKeyId: string;
  status: KeyStatus;
  errorMessage?: string;
  processingBasis?: string;
  nodeId?: string;
}

export interface ManualFixRequest {
  cacheKeyId: string;
  action: 'retry' | 'skip' | 'mark_success';
  reason: string;
  operator: string;
}

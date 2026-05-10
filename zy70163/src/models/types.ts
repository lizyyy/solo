export enum StorageClass {
  STANDARD = 'STANDARD',
  INFREQUENT_ACCESS = 'INFREQUENT_ACCESS',
  ARCHIVE = 'ARCHIVE',
  DEEP_ARCHIVE = 'DEEP_ARCHIVE'
}

export enum LifecycleAction {
  TRANSITION = 'TRANSITION',
  DELETE = 'DELETE'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRY_PENDING = 'RETRY_PENDING'
}

export enum ThawJobStatus {
  PENDING = 'PENDING',
  RESTORING = 'RESTORING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  RETRY_PENDING = 'RETRY_PENDING'
}

export interface ObjectMetadata {
  objectId: string;
  bucketName: string;
  objectKey: string;
  size: number;
  storageClass: StorageClass;
  lastModified: string;
  createdTime: string;
  eTag: string;
  versionId: string;
  deleteProtection: boolean;
  tags: Record<string, string>;
  currentThawJobId?: string;
}

export interface LifecycleRule {
  ruleId: string;
  bucketName: string;
  ruleName: string;
  status: 'enabled' | 'disabled';
  prefix?: string;
  tags?: Record<string, string>;
  actions: LifecycleRuleAction[];
  priority: number;
  createdTime: string;
  lastModified: string;
}

export interface LifecycleRuleAction {
  action: LifecycleAction;
  daysAfterCreation?: number;
  daysAfterModification?: number;
  targetStorageClass?: StorageClass;
}

export interface ThawJob {
  thawJobId: string;
  objectId: string;
  objectKey: string;
  bucketName: string;
  requestedBy: string;
  requestedAt: string;
  status: ThawJobStatus;
  thawDays: number;
  retrievalTier: 'expedited' | 'standard' | 'bulk';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
}

export interface OperationLog {
  logId: string;
  operation: string;
  objectId?: string;
  bucketName?: string;
  objectKey?: string;
  requestId: string;
  userId: string;
  timestamp: string;
  status: 'success' | 'failed';
  details: string;
  costEstimate?: number;
}

export interface CostEstimate {
  objectId: string;
  objectKey: string;
  operation: string;
  estimatedCost: number;
  breakdown: {
    item: string;
    cost: number;
  }[];
}

export interface ProcessingResult {
  success: boolean;
  objectId?: string;
  status?: StorageClass;
  thawJobId?: string;
  costEstimate?: CostEstimate;
  logId?: string;
  error?: string;
  warnings?: string[];
  isRetry?: boolean;
  retryAt?: string;
}

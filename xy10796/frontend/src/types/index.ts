export interface Environment {
  id: string;
  name: string;
  description?: string;
  status: string;
  baseUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetVersion {
  id: string;
  version: string;
  name: string;
  description?: string;
  status: string;
  recordCount: number;
  importOrder: number;
  schema?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SeedTask {
  id: string;
  idempotencyKey: string;
  environmentId: string;
  datasetVersionId: string;
  status: TaskStatus;
  importOrder: number;
  retryCount: number;
  maxRetries: number;
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  Environment?: Environment;
  DatasetVersion?: DatasetVersion;
}

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
  RETRYING = 'retrying',
}

export interface SeedRecord {
  id: string;
  taskId: string;
  recordId: string;
  recordData: Record<string, any>;
  status: string;
  errorMessage?: string;
  importedAt?: string;
  rolledBackAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RollbackRecord {
  id: string;
  taskId: string;
  reason: string;
  reviewedBy?: string;
  reviewComment?: string;
  status: string;
  rolledBackRecords: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  reviewedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CleanupStrategy {
  id: string;
  name: string;
  description?: string;
  environmentId: string;
  cleanupType: string;
  retentionDays: number;
  status: string;
  lastExecutedAt?: string;
  errorMessage?: string;
  correctionPath?: string;
  metadata?: Record<string, any>;
  Environment?: Environment;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalTasks: number;
  successTasks: number;
  failedTasks: number;
  successRate: number;
  totalRecords: number;
  environments: number;
  datasets: number;
  pendingReview: number;
}

export interface TaskTrend {
  date: string;
  total: number;
  success: number;
  failed: number;
}

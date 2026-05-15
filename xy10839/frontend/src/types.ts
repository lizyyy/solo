export type ExportStatus = 'pending' | 'snapshot' | 'packing' | 'verifying' | 'completed' | 'failed';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface DataScope {
  id: string;
  tenantId: string;
  name: string;
  scopeType: 'full' | 'incremental' | 'custom';
  dateRange?: { start: number; end: number };
  dataTypes: string[];
  snapshotVersion: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExportTask {
  id: string;
  tenantId: string;
  scopeId: string;
  name: string;
  status: ExportStatus;
  progress: number;
  errorMessage?: string;
  errorStack?: string;
  retryCount: number;
  maxRetries: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  expiredAt: number;
}

export interface FileManifest {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  checksum: string;
  status: 'pending' | 'packed' | 'verified' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface VerificationSummary {
  id: string;
  taskId: string;
  totalFiles: number;
  totalSize: number;
  checksum: string;
  algorithm: string;
  metadata: Record<string, any>;
  verifiedAt: number;
  isValid: boolean;
}

export interface TaskResponse {
  task: ExportTask;
  scope?: DataScope;
  tenant?: Tenant;
  files?: FileManifest[];
  verification?: VerificationSummary;
}

export interface CreateTaskRequest {
  tenantId: string;
  scopeId?: string;
  name: string;
  dataTypes: string[];
  dateRange?: { start: number; end: number };
  createdBy: string;
}

export enum ExportStatus {
  PENDING = 'pending',
  SNAPSHOT = 'snapshot',
  PACKING = 'packing',
  VERIFYING = 'verifying',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

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
  filters?: Record<string, any>;
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

export interface DownloadRecord {
  id: string;
  taskId: string;
  downloadToken: string;
  downloadedBy: string;
  downloadedAt: number;
  clientIp: string;
  userAgent: string;
  expiresAt: number;
}

export interface ExportCertificateData {
  id: string;
  taskId: string;
  certificateNumber: string;
  issuedAt: number;
  issuer: string;
  metadata: {
    tenantName: string;
    exportTime: number;
    fileCount: number;
    totalSize: number;
    checksum: string;
  };
  signature: string;
}

export interface ExportCertificate extends ExportCertificateData {
  isVerified: boolean;
}

export interface CreateTaskRequest {
  tenantId: string;
  scopeId?: string;
  name: string;
  dataTypes: string[];
  dateRange?: { start: number; end: number };
  createdBy: string;
}

export interface TaskResponse {
  task: ExportTask;
  scope?: DataScope;
  tenant?: Tenant;
  files?: FileManifest[];
  verification?: VerificationSummary;
  certificate?: ExportCertificate;
  downloadUrl?: string;
}

export enum CertificateStatus {
  PENDING_UPLOAD = 'pending_upload',
  VERIFYING = 'verifying',
  DEPLOYED = 'deployed',
  NEED_ROLLBACK = 'need_rollback',
}

export enum OperationSource {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  API = 'api',
  IMPORT = 'import',
}

export interface DomainCertificate {
  id: string;
  domain: string;
  certificateChain: string | null;
  expiryDate: string | null;
  deployNodes: string[];
  verifiedNodes: string[];
  status: CertificateStatus;
  remarks: string | null;
  forceProceed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateHistory {
  id: string;
  certificateId: string;
  operationSource: OperationSource;
  operator: string;
  action: string;
  oldStatus: CertificateStatus | null;
  newStatus: CertificateStatus | null;
  changes: Record<string, any> | null;
  remarks: string | null;
  createdAt: string;
}

export interface CreateCertificateRequest {
  domain: string;
  certificateChain?: string;
  expiryDate?: string;
  deployNodes: string[];
  operator: string;
  operationSource: OperationSource;
}

export interface UpdateCertificateRequest {
  certificateChain?: string;
  expiryDate?: string;
  deployNodes?: string[];
  verifiedNodes?: string[];
  status?: CertificateStatus;
  remarks?: string;
  forceProceed?: boolean;
  operator: string;
  operationSource: OperationSource;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  suggestion: 'retry' | 'fix_data' | 'manual' | 'none';
}

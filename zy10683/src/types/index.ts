export enum AttachmentStatus {
  PENDING_UPLOAD = 'pending_upload',
  UPLOADED = 'uploaded',
  VALIDATION_FAILED = 'validation_failed',
  ARCHIVED = 'archived',
}

export enum ValidationResult {
  PASS = 'pass',
  FAIL = 'fail',
  VERSION_MISMATCH = 'version_mismatch',
}

export interface Contract {
  id: string;
  contractNo: string;
  contractName: string;
  businessObject: string;
  contractVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentItem {
  id: string;
  contractId: string;
  attachmentName: string;
  attachmentType: string;
  required: boolean;
  status: AttachmentStatus;
  currentVersion?: string;
  expectedVersion: string;
  uploadedBy?: string;
  uploadedAt?: string;
  validationResult?: ValidationResult;
  validationMessage?: string;
  versionMismatch: boolean;
}

export interface SupplementRecord {
  id: string;
  attachmentItemId: string;
  contractId: string;
  uploadedBy: string;
  uploadedAt: string;
  fileVersion: string;
  fileName: string;
  fileSize: number;
  validationResult: ValidationResult;
  validationMessage?: string;
  versionMismatch: boolean;
}

export interface HistoryRecord {
  id: string;
  attachmentItemId: string;
  contractId: string;
  action: string;
  operator: string;
  operateAt: string;
  beforeStatus?: AttachmentStatus;
  afterStatus?: AttachmentStatus;
  remark?: string;
  versionMismatch?: boolean;
  details?: Record<string, unknown>;
}

export interface ExportRow {
  contractNo: string;
  contractName: string;
  businessObject: string;
  contractVersion: string;
  attachmentName: string;
  attachmentType: string;
  status: string;
  statusText: string;
  uploadedBy?: string;
  uploadedAt?: string;
  validationResult?: string;
  validationResultText?: string;
  validationMessage?: string;
  versionMismatch: boolean;
  versionMismatchText: string;
  currentVersion?: string;
  expectedVersion: string;
  responsiblePerson: string;
}

export type FilterParams = {
  startDate?: string;
  endDate?: string;
  status?: AttachmentStatus;
  responsiblePerson?: string;
  businessObject?: string;
};

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ValidationStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  MANUALLY_CORRECTED = 'manually_corrected'
}

export interface FileRecord {
  id: string;
  batchId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  supplierCode: string;
  supplierName: string;
  department: string;
  uploadTime: Date;
  uploader: string;
  originalSupplierCode?: string;
  originalSupplierName?: string;
}

export interface ValidationResult {
  id: string;
  fileRecordId: string;
  batchId: string;
  checkType: string;
  fieldName?: string;
  status: ValidationStatus;
  riskLevel: RiskLevel;
  errorMessage?: string;
  expectedValue?: string;
  actualValue?: string;
  checkedAt: Date;
}

export interface FailedItem {
  id: string;
  batchId: string;
  fileRecordId: string;
  validationResultId: string;
  checkType: string;
  fieldName?: string;
  errorMessage: string;
  riskLevel: RiskLevel;
  fileName: string;
  supplierCode: string;
  supplierName: string;
  department: string;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolver?: string;
}

export interface CorrectionRecord {
  id: string;
  fileRecordId: string;
  batchId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  correctedBy: string;
  correctionReason: string;
  correctionTime: Date;
  riskLevel: RiskLevel;
  previousStatus: ValidationStatus;
  newStatus: ValidationStatus;
}

export interface RollbackCandidate {
  id: string;
  batchId: string;
  fileRecordId: string;
  fileName: string;
  supplierCode: string;
  reason: string;
  riskLevel: RiskLevel;
  createdAt: Date;
  createdBy?: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNote?: string;
}

export interface ValidationBatch {
  id: string;
  batchName: string;
  department: string;
  totalFiles: number;
  successCount: number;
  failedCount: number;
  manuallyCorrectedCount: number;
  createdAt: Date;
  createdBy: string;
  status: 'processing' | 'completed' | 'rolled_back';
}

export type OutputFormat = 'json' | 'markdown' | 'download';

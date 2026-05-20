export enum BoothStatus {
  NORMAL = 'normal',
  PENDING = 'pending',
  FAILED = 'failed'
}

export enum DocumentType {
  BUSINESS_LICENSE = 'business_license',
  FIRE_SAFETY = 'fire_safety',
  DEPOSIT_RECEIPT = 'deposit_receipt'
}

export enum FailureReason {
  DOCUMENT_EXPIRED = 'document_expired',
  TIME_CONFLICT = 'time_conflict',
  DEPOSIT_INSUFFICIENT = 'deposit_insufficient',
  MISSING_DOCUMENT = 'missing_document',
  INVALID_DATA = 'invalid_data',
  DUPLICATE_SUBMISSION = 'duplicate_submission'
}

export interface BoothApplication {
  id: string;
  batchId: string;
  boothNumber: string;
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  startTime: string;
  endTime: string;
  depositAmount: number;
  depositPaid: number;
  documents: DocumentInfo[];
  createdAt: string;
  submittedAt?: string;
}

export interface DocumentInfo {
  id: string;
  type: DocumentType;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  fileName?: string;
  fileUrl?: string;
  verified: boolean;
}

export interface CalendarEvent {
  id: string;
  boothNumber: string;
  startTime: string;
  endTime: string;
  companyName: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface ValidationResult {
  applicationId: string;
  boothNumber: string;
  companyName: string;
  status: BoothStatus;
  originalData: Record<string, any>;
  issues: IssueDetail[];
  suggestions: string[];
  processedAt: string;
  traceId: string;
}

export interface IssueDetail {
  field: string;
  reason: FailureReason;
  message: string;
  currentValue?: any;
  expectedValue?: any;
}

export interface ProcessReport {
  reportId: string;
  batchId: string;
  totalCount: number;
  normalCount: number;
  pendingCount: number;
  failedCount: number;
  results: ValidationResult[];
  generatedAt: string;
}

export interface SubmissionRecord {
  batchId: string;
  applicationIds: string[];
  submittedAt: string;
  processed: boolean;
  effective: boolean;
}

export enum ClassificationLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  TOP_SECRET = 'top_secret'
}

export enum BorrowStatus {
  BORROWED = 'borrowed',
  RETURNED = 'returned',
  EXTENDED = 'extended',
  OVERDUE = 'overdue'
}

export enum ReviewAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_MORE_INFO = 'needs_more_info',
  MANUAL_CORRECTION = 'manual_correction'
}

export enum DiscrepancyType {
  OVERDUE = 'overdue',
  CLASSIFICATION_MISMATCH = 'classification_mismatch',
  RENEWAL_LIMIT_EXCEEDED = 'renewal_limit_exceeded',
  PERMISSION_DENIED = 'permission_denied',
  MISSING_RECORD = 'missing_record',
  DATE_CONFLICT = 'date_conflict'
}

export interface Case {
  caseId: string;
  caseNumber: string;
  title: string;
  classification: ClassificationLevel;
  createDate: string;
  handler: string;
  description?: string;
}

export interface BorrowRecord {
  recordId: string;
  caseId: string;
  borrowerId: string;
  borrowerName: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  status: BorrowStatus;
  renewalCount: number;
  handlerSignature?: string;
  remarks?: string;
}

export interface UserPermission {
  userId: string;
  userName: string;
  department: string;
  allowedClassifications: ClassificationLevel[];
  maxBorrowDays: number;
  maxRenewals: number;
  isActive: boolean;
}

export interface Discrepancy {
  discrepancyId: string;
  type: DiscrepancyType;
  recordId: string;
  caseId: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  explanation: string;
  isResolved: boolean;
}

export interface ReviewLog {
  logId: string;
  recordId: string;
  reviewerId: string;
  reviewerName: string;
  action: ReviewAction;
  comment: string;
  timestamp: string;
  previousStatus?: BorrowStatus;
  newStatus?: BorrowStatus;
}

export interface ReconciliationResult {
  reconciliationId: string;
  createdAt: string;
  totalRecords: number;
  matchedRecords: number;
  discrepancyCount: number;
  discrepancies: Discrepancy[];
  reviewedRecords: string[];
  summary: {
    overdue: number;
    classificationIssues: number;
    renewalIssues: number;
    permissionIssues: number;
  };
}

export interface ReportData {
  reconciliationId: string;
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalBorrowed: number;
    returned: number;
    overdue: number;
    pendingReview: number;
  };
  discrepancies: Discrepancy[];
  reviewLogs: ReviewLog[];
  details: {
    caseId: string;
    caseNumber: string;
    caseTitle: string;
    classification: ClassificationLevel;
    borrower: string;
    borrowDate: string;
    dueDate: string;
    status: string;
    issues: string[];
    reviewStatus: string;
  }[];
}

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  totalCount: number;
  validCount: number;
}

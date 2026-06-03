export type LineType = 'PRINCIPAL' | 'FEE' | 'COMBINED';

export type RecordStatus =
  | 'EMAIL_IMPORTED'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'CONFLICT_REJECTED'
  | 'BATCH_SUPPLIED'
  | 'SPLIT_LINES_PENDING'
  | 'SUPERVISOR_REVIEWED'
  | 'DIFF_UPDATED'
  | 'COMPLETED';

export type ConflictType =
  | 'BATCH_EMAIL_MISMATCH'
  | 'DUPLICATE_IMPORT'
  | 'SPLIT_LINE_AMOUNT_MISMATCH';

export type SelfCheckType =
  | 'DUPLICATE_IMPORT'
  | 'SPLIT_LINES_DETECTED'
  | 'RECALCULATION_AFTER_SUPPLEMENT'
  | 'EXPORT_CONSISTENCY';

export type SelfCheckResult = 'PASSED' | 'WARNING' | 'FAILED';

export type Role = 'MANAGER' | 'OPERATOR' | 'SUPERVISOR';

export interface CalculationParams {
  version: string;
  effectiveDate: string;
  description: string;
}

export interface CalculationTrace {
  paramsVersion: string;
  decisionReason: string;
  calculatedAt: string;
  calculatedBy: string;
}

export interface ConflictEvidence {
  id: string;
  conflictType: ConflictType;
  description: string;
  emailSource: string | null;
  batchSource: string | null;
  emailValue: string | null;
  batchValue: string | null;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: 'CONFIRM_EMAIL' | 'CONFIRM_BATCH' | 'REJECT_BOTH';
  resolvedBy?: string;
}

export interface BusinessRecordLine {
  id: string;
  lineType: LineType;
  businessNo: string;
  amount: number;
  currency: string;
  tradeDate: string;
  fundCode: string;
  fundName: string;
  calculationTrace: CalculationTrace;
}

export interface SelfCheckIssue {
  id: string;
  checkType: SelfCheckType;
  result: SelfCheckResult;
  description: string;
  relatedRecordIds: string[];
  relatedLineIds: string[];
  detectedAt: string;
}

export interface PensionFundSwapRecord {
  id: string;
  businessNo: string;
  status: RecordStatus;
  lines: BusinessRecordLine[];
  managerEmailSource: string;
  managerEmailContent: string;
  managerEmailImportedAt: string;
  managerEmailImportedBy: string;
  settlementBatchNo?: string;
  settlementBatchSuppliedAt?: string;
  settlementBatchSuppliedBy?: string;
  conflicts: ConflictEvidence[];
  selfCheckIssues: SelfCheckIssue[];
  supervisorReviewedAt?: string;
  supervisorReviewedBy?: string;
  diffListUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportEmailRequest {
  emailSource: string;
  emailContent: string;
  businessNo: string;
  lines: Array<Omit<BusinessRecordLine, 'id' | 'calculationTrace'>>;
  importedBy: string;
}

export interface SupplyBatchRequest {
  recordId: string;
  settlementBatchNo: string;
  suppliedBy: string;
}

export interface ResolveConflictRequest {
  recordId: string;
  conflictId: string;
  resolution: 'CONFIRM_EMAIL' | 'CONFIRM_BATCH' | 'REJECT_BOTH';
  resolvedBy: string;
}

export interface SupervisorReviewRequest {
  recordId: string;
  reviewedBy: string;
  approved: boolean;
  reviewComment?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UnifiedRecordView {
  record: PensionFundSwapRecord;
  totalPrincipal: number;
  totalFee: number;
  totalAmount: number;
  hasSplitLines: boolean;
  hasConflicts: boolean;
  pendingActions: Role[];
}

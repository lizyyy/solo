export type TransactionType = 'PRINCIPAL' | 'FEE' | 'COMBINED';

export type RecordStatus = 
  | 'PENDING_REVIEW' 
  | 'NORMAL' 
  | 'SPLIT_PENDING' 
  | 'DISPUTED' 
  | 'ROLLBACKED';

export type ImportSource = 'COUNTER' | 'EMAIL';

export type WorkflowStep = 
  | 'STEP1_IMPORTED' 
  | 'STEP2_EMAIL_SUPPLEMENTED' 
  | 'STEP3_DIFF_UPDATED';

export interface CounterTransaction {
  id: string;
  tailNumber: string;
  businessNumber: string;
  transactionDate: string;
  amount: number;
  transactionType: TransactionType;
  counterparty: string;
  remark: string;
  importBatchId: string;
  importedAt: string;
  importedBy: string;
}

export interface EmailSupplement {
  id: string;
  businessNumber: string;
  emailId: string;
  subject: string;
  sender: string;
  sentAt: string;
  supplementContent: string;
  attachedFiles: string[];
  importedAt: string;
  importedBy: string;
}

export interface MarginCalculation {
  id: string;
  businessNumber: string;
  calculationDate: string;
  scenario: string;
  baseMargin: number;
  stressMargin: number;
  marginRatio: number;
  status: RecordStatus;
  workflowStep: WorkflowStep;
  hasSplit: boolean;
  isPendingReview: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiffRecord {
  id: string;
  businessNumber: string;
  fieldName: string;
  counterValue: string;
  emailValue: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
  createdAt: string;
}

export interface HistoryVersion {
  id: string;
  entityType: 'TRANSACTION' | 'CALCULATION' | 'EMAIL';
  entityId: string;
  version: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';
  changedFields: Record<string, { old: any; new: any }>;
  operatedBy: string;
  operatedAt: string;
  remark: string;
}

export interface ImportBatch {
  id: string;
  source: ImportSource;
  fileName: string;
  recordCount: number;
  importedAt: string;
  importedBy: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errorMessage?: string;
}

export interface SplitInfo {
  businessNumber: string;
  principalId: string;
  feeId: string;
  principalAmount: number;
  feeAmount: number;
  totalAmount: number;
  isMatched: boolean;
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
  confirmedBy?: string;
  confirmedAt?: string;
}

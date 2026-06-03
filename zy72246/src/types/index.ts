export enum ProcessingStatus {
  PENDING = 'PENDING',
  REVERSAL_PENDING_REVIEW = 'REVERSAL_PENDING_REVIEW',
  NORMAL = 'NORMAL',
  REJECTED = 'REJECTED',
  SUPPLEMENT_COMPLETED = 'SUPPLEMENT_COMPLETED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  COMPLETED = 'COMPLETED',
}

export enum ProcessStep {
  STEP_1_IMPORT = 'STEP_1_IMPORT',
  STEP_2_SUPPLEMENT = 'STEP_2_SUPPLEMENT',
  STEP_3_SUMMARY = 'STEP_3_SUMMARY',
}

export interface TaxNote {
  id: string;
  originalLineNumber: string;
  tradeDate: string;
  stockCode: string;
  stockName: string;
  serialNumber: string;
  originalAmount: number;
  currentAmount: number;
  originalRemark: string;
  currentRemark: string;
  counterTailNumber: string;
  summary: string;
  processingStatus: ProcessingStatus;
  currentStep: ProcessStep;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface TaxNoteVersion {
  id: string;
  taxNoteId: string;
  versionNumber: number;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  changeReason: string;
}

export interface StatusHistory {
  id: string;
  taxNoteId: string;
  fromStatus: ProcessingStatus | null;
  toStatus: ProcessingStatus;
  operatedBy: string;
  operatedAt: string;
  remark: string;
}

export interface ReviewRecord {
  id: string;
  taxNoteId: string;
  reviewResult: 'APPROVED' | 'REJECTED';
  reviewOpinion: string;
  reviewedBy: string;
  reviewedAt: string;
  isReversed: boolean;
  reversedBy?: string;
  reversedAt?: string;
}

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  rollbackMethod: string;
  codeReference: string;
  status: 'ACTIVE' | 'DEPRECATED';
}

export interface ImportResult {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  reversalPendingRecords: number;
  details: ImportDetail[];
}

export interface ImportDetail {
  lineNumber: string;
  action: 'NEW' | 'UPDATE' | 'SKIP' | 'ERROR';
  reason: string;
  recordId?: string;
}

export interface ImportRowData {
  lineNumber: string;
  tradeDate: string;
  stockCode: string;
  stockName: string;
  serialNumber: string;
  amount: number;
  remark: string;
  counterTailNumber: string;
}

export interface AppState {
  taxNotes: TaxNote[];
  versions: TaxNoteVersion[];
  statusHistories: StatusHistory[];
  reviewRecords: ReviewRecord[];
  currentUser: string;
  filter: {
    status?: ProcessingStatus;
    step?: ProcessStep;
    keyword?: string;
  };
}

export type ActionType =
  | { type: 'IMPORT_DATA'; payload: { taxNotes: TaxNote[]; versions: TaxNoteVersion[]; statusHistories: StatusHistory[] } }
  | { type: 'UPDATE_TAX_NOTE'; payload: { id: string; updates: Partial<TaxNote>; reason: string } }
  | { type: 'CHANGE_STATUS'; payload: { id: string; toStatus: ProcessingStatus; remark: string } }
  | { type: 'REVIEW_RECORD'; payload: { id: string; result: 'APPROVED' | 'REJECTED'; opinion: string } }
  | { type: 'ROLLBACK_STATUS'; payload: { id: string; reason: string } }
  | { type: 'SET_FILTER'; payload: Partial<AppState['filter']> }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };

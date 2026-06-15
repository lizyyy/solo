import os

content = """export enum ProcessingStatus {
  PENDING = 'PENDING',
  REVERSAL_PENDING_REVIEW = 'REVERSAL_PENDING_REVIEW',
  NORMAL = 'NORMAL',
  REJECTED = 'REJECTED',
  SUPPLEMENT_COMPLETED = 'SUPPLEMENT_COMPLETED',
  BALANCE_UPDATED = 'BALANCE_UPDATED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  COMPLETED = 'COMPLETED',
}

export enum ProcessStep {
  STEP_1_IMPORT = 'STEP_1_IMPORT',
  STEP_2_SUPPLEMENT = 'STEP_2_SUPPLEMENT',
  STEP_3_BALANCE = 'STEP_3_BALANCE',
  STEP_4_SUMMARY = 'STEP_4_SUMMARY',
}

export enum DuplicateAction {
  CONFIRM_UPDATE = 'CONFIRM_UPDATE',
  SKIP = 'SKIP',
  MERGE = 'MERGE',
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
  holidayRemark?: string;
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

export interface BalanceChangeRecord {
  id: string;
  taxNoteId: string;
  previousBalance: number;
  changeAmount: number;
  newBalance: number;
  changeType: 'TAX' | 'ADJUSTMENT' | 'REVERSAL' | 'HOLIDAY';
  changeDate: string;
  remark: string;
  generatedBy: string;
  generatedAt: string;
  version: number;
}

export interface DuplicateResolution {
  rowIndex: number;
  recordId: string;
  action: DuplicateAction;
  mergeRemark?: string;
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
  duplicateRecords: number;
  details: ImportDetail[];
}

export interface ImportDetail {
  lineNumber: string;
  action: 'NEW' | 'UPDATE' | 'SKIP' | 'ERROR' | 'DUPLICATE';
  reason: string;
  recordId?: string;
  existingRecord?: TaxNote;
  newRowData?: ImportRowData;
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
  balanceChanges: BalanceChangeRecord[];
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
  | { type: 'GENERATE_BALANCE_CHANGE'; payload: { balanceChange: BalanceChangeRecord; taxNoteUpdates?: { id: string; updates: Partial<TaxNote>; reason: string } } }
  | { type: 'SET_FILTER'; payload: Partial<AppState['filter']> }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };
"""

os.makedirs('/Users/lzy/pro/solo/workspaces/zy72246/src/types', exist_ok=True)
with open('/Users/lzy/pro/solo/workspaces/zy72246/src/types/index.ts', 'w') as f:
    f.write(content)
size = os.path.getsize('/Users/lzy/pro/solo/workspaces/zy72246/src/types/index.ts')
print(f'File size: {size} bytes')

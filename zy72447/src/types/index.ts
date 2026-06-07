export enum RecordStatus {
  PENDING_IMPORT = 'pending_import',
  IMPORTED = 'imported',
  MATCHED = 'matched',
  NEEDS_REVIEW = 'needs_review',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  SUPERSEDED = 'superseded'
}

export enum ReviewReason {
  TEMP_SUBSTITUTE_ONLY_IN_GROUP = 'temp_substitute_only_in_group',
  CONTRACT_MISSING = 'contract_missing',
  GROUP_RECORD_MISSING = 'group_record_missing',
  INFO_MISMATCH = 'info_mismatch',
  MANUAL_REVIEW_REQUIRED = 'manual_review_required'
}

export enum DataSource {
  GROUP_SIGNUP = 'group_signup',
  CONTRACT_SCREENSHOT = 'contract_screenshot'
}

export interface GroupSignupRecord {
  id: string;
  originalRowNumber: number;
  rawContent: string;
  performerName?: string;
  songName?: string;
  isTemporarySubstitute?: boolean;
  substituteNote?: string;
  importedAt: string;
  importBatchId: string;
  status: RecordStatus;
  manualEdits: ManualEdit[];
}

export interface ContractRecord {
  id: string;
  rawContent: string;
  performerName?: string;
  songName?: string;
  contractReference?: string;
  performanceDate?: string;
  importedAt: string;
  importBatchId: string;
  sourceFileName?: string;
  status: RecordStatus;
  manualEdits: ManualEdit[];
}

export interface ManualEdit {
  id: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  editedBy: string;
  editedAt: string;
  reason?: string;
}

export interface ReconciliationResult {
  id: string;
  groupRecordId?: string;
  contractRecordId?: string;
  matchedPerformerName?: string;
  matchedSongName?: string;
  status: RecordStatus;
  reviewReasons: ReviewReason[];
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  isLateContractRefresh: boolean;
}

export interface OperationLog {
  id: string;
  operationType: string;
  entityType: string;
  entityId?: string;
  oldState?: any;
  newState?: any;
  operator: string;
  timestamp: string;
  batchId?: string;
  notes?: string;
}

export interface ImportBatch {
  id: string;
  source: DataSource;
  fileName: string;
  importedAt: string;
  recordCount: number;
  operator: string;
}

export interface ReconciliationState {
  groupRecords: GroupSignupRecord[];
  contractRecords: ContractRecord[];
  results: ReconciliationResult[];
  logs: OperationLog[];
  batches: ImportBatch[];
  lastUpdated: string;
}

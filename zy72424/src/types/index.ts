export interface ContractScreenshot {
  id: string;
  fileName: string;
  fileHash: string;
  fileUrl: string;
  fileSize: number;
  uploadTime: Date;
  lastImportTime: Date;
  importCount: number;
}

export interface TrackAlias {
  id: string;
  trackName: string;
  aliasName: string;
  remark: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export type RecordStatus = 'normal' | 'pending_review' | 'reviewed';

export interface RehearsalRecord {
  id: string;
  rehearsalDate: Date;
  personName: string;
  trackId: string;
  contractId: string;
  trackRemark: string;
  isLate: boolean;
  lateMinutes: number;
  status: RecordStatus;
  hasReworkReason: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ChangeType = 'create' | 'update' | 'delete' | 'rollback';
export type EntityType = 'track_alias' | 'rehearsal_record' | 'contract' | 'review_task';

export interface ChangeHistory {
  id: string;
  entityType: EntityType;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: Date;
  changeType: ChangeType;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewTask {
  id: string;
  recordId: string;
  reworkReason: string;
  reviewStatus: ReviewStatus;
  reviewComment: string;
  reviewedBy: string;
  reviewedAt: Date | null;
}

export interface BoundaryRules {
  remarkPreserve: {
    preserveLineBreaks: boolean;
    preserveWhitespace: boolean;
    noTruncation: boolean;
  };
  reworkDetection: {
    keywords: string[];
    caseSensitive: boolean;
    useRegex: boolean;
  };
  duplicateImport: {
    hashAlgorithm: 'sha256';
    updateTimeOnDuplicate: boolean;
    preventDuplicateStats: boolean;
  };
  historyTracking: {
    trackAllFields: boolean;
    keepFullHistory: boolean;
    enableRollback: boolean;
  };
}

export interface ReworkDetectionResult {
  hasRework: boolean;
  matchedKeywords: string[];
  detectionTime: Date;
}

export interface DiffResult {
  added: { value: string; position: number }[];
  removed: { value: string; position: number }[];
  unchanged: { value: string; position: number }[];
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'store_manager' | 'copyright';
  avatar?: string;
}

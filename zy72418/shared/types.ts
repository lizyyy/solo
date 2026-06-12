export type RecordStatus =
  | "new"
  | "duplicate_current"
  | "duplicate_history"
  | "pending_review"
  | "normal"
  | "conflict";

export type ConflictResolution = "confirm" | "reject" | null;
export type SubstituteSource = "audio_remark" | "group_message" | "formal";
export type OperatorRole = "admin" | "coordinator" | "ticket" | "finance" | "system";

export interface AudioRecord {
  id: string;
  audioFileId: string;
  audioFileName: string;
  remark: string;
  courseName: string;
  therapistName: string;
  sessionDate: string;
  duration: number;
  amount: number;
  isTemporarySubstitute: boolean;
  substituteSource: SubstituteSource;
  authorizationExpiryDate: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  importBatchId: string;
  settlementAmount?: number;
  errorNote?: string;
}

export interface ConflictRecord {
  id: string;
  recordId: string;
  fieldName: string;
  audioRemarkValue: string;
  authorizationValue: string;
  audioRemarkSource: string;
  authorizationSource: string;
  resolution: ConflictResolution;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  createdAt: string;
  record?: AudioRecord;
}

export interface AuditLog {
  id: string;
  recordId: string;
  operator: string;
  operatorRole: OperatorRole;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  affectedResultIds: string[];
  createdAt: string;
}

export interface SelfCheckReport {
  checkDuplicateImport: {
    passed: boolean;
    details: { batchId: string; duplicateCount: number; message: string }[];
  };
  checkTemporarySubstitute: {
    passed: boolean;
    details: { recordId: string; status: string; message: string }[];
  };
  checkRecalculationAfterSupplement: {
    passed: boolean;
    details: { recordId: string; recalculated: boolean; message: string }[];
  };
  checkExportConsistency: {
    passed: boolean;
    details: {
      exportHash: string;
      pageHash: string;
      apiHash: string;
      consistent: boolean;
    }[];
  };
  overallPassed: boolean;
  checkedAt: string;
}

export interface ImportPreviewResult {
  newRecords: AudioRecord[];
  duplicateCurrent: AudioRecord[];
  duplicateHistory: AudioRecord[];
  temporarySubstituteCount: number;
  potentialConflicts: number;
  importBatchId: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  totalCount: number;
  newCount: number;
  duplicateCurrentCount: number;
  duplicateHistoryCount: number;
  importedBy: string;
  createdAt: string;
}

export interface AuthorizationPage {
  id: string;
  recordId: string;
  expiryDate: string;
  authorizedAmount: number;
  sourceDocument: string;
  createdAt: string;
}

export interface UpdateRecordRequest {
  remark?: string;
  courseName?: string;
  therapistName?: string;
  sessionDate?: string;
  duration?: number;
  amount?: number;
  authorizationExpiryDate?: string;
  errorNote?: string;
  operator: string;
  operatorRole: OperatorRole;
  reason: string;
}

export interface ResolveConflictRequest {
  resolution: "confirm" | "reject";
  reason: string;
  operator: string;
  operatorRole: OperatorRole;
}

export interface ReviewSubstituteRequest {
  recordId: string;
  approved: boolean;
  reason: string;
  operator: string;
  operatorRole: OperatorRole;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  new: "新记录",
  duplicate_current: "本次重复",
  duplicate_history: "历史重复",
  pending_review: "待票务复核",
  normal: "正常",
  conflict: "存在冲突",
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  new: "bg-success-100 text-success-700 border-success-300",
  duplicate_current: "bg-gray-100 text-gray-700 border-gray-300",
  duplicate_history: "bg-warning-100 text-warning-700 border-warning-300",
  pending_review: "bg-warning-100 text-warning-700 border-warning-300",
  normal: "bg-primary-100 text-primary-700 border-primary-300",
  conflict: "bg-danger-100 text-danger-700 border-danger-300",
};

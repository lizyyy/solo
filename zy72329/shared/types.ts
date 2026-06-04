export type RecordStatus =
  | 'smooth'
  | 'gap'
  | 'supplement'
  | 'conflict'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'reviewed_normal'
  | 'reviewed_abnormal';

export interface BillRecord {
  id: string;
  recordNo: string;
  date: string;
  teacherName: string;
  amount: number;
  itemType: string;
  status: RecordStatus;
  teacherNoteId?: string;
  samplingListId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherNote {
  id: string;
  recordNo: string;
  date: string;
  teacherName: string;
  amount: number;
  itemType: string;
  annotation: string;
  importBatchId: string;
  importedAt: string;
  importedBy: string;
}

export interface SamplingList {
  id: string;
  recordNo: string;
  date: string;
  teacherName: string;
  amount: number;
  itemType: string;
  sceneDescription: string;
  isOldFormat: boolean;
  importBatchId: string;
  importedAt: string;
  importedBy: string;
}

export interface ParamVersion {
  id: string;
  version: string;
  snapshot: string;
  changeSummary: string;
  operator: string;
  createdAt: string;
  recordCount: {
    smooth: number;
    gap: number;
    supplement: number;
    conflict: number;
  };
}

export type OperationType =
  | 'import'
  | 'match'
  | 'conflict_resolve'
  | 'gap_review'
  | 'version_create';

export interface OperationHistory {
  id: string;
  recordId?: string;
  operationType: OperationType;
  description: string;
  operator: string;
  operatorRole: string;
  beforeState?: string;
  afterState?: string;
  createdAt: string;
}

export type ConflictResolution = 'teacher_note' | 'sampling_list' | 'rejected';

export interface ConflictRecord {
  id: string;
  recordId: string;
  teacherNoteId: string;
  samplingListId: string;
  conflictingFields: Array<{
    field: string;
    teacherNoteValue: string | number;
    samplingListValue: string | number;
  }>;
  resolution?: ConflictResolution;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export type GapReviewStatus = 'pending' | 'normal' | 'abnormal';

export interface GapRecord {
  id: string;
  recordId: string;
  missingRecordNo: string;
  previousRecordNo: string;
  nextRecordNo: string;
  reviewStatus: GapReviewStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export type UserRole = 'admin' | 'coach' | 'reviewer';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

export interface EvidenceItem {
  id: string;
  type: string;
  source: string;
  content: string;
  timestamp: string;
  operator: string;
}

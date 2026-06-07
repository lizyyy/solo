export type RecordStatus = 'pending_import' | 'pending_review' | 'pending_summary' | 'completed';
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';
export type NameReviewStatus = 'pending' | 'confirmed';

export interface CalculationMeta {
  paramVersion: string;
  decisionReason: string;
  calculationTime: string;
  algorithm: string;
}

export interface ConflictPoint {
  field: string;
  redLineValue: string;
  gridValue: string;
  description: string;
}

export interface OperationLog {
  id: string;
  recordId: string;
  action: string;
  operator: string;
  operateTime: string;
  detail: string;
}

export interface AcceptanceRecord {
  id: string;
  redLineNo: string;
  communityName: string;
  communityNameOld?: string;
  redLineRemark: string;
  gridInspection: string;
  status: RecordStatus;
  hasConflict: boolean;
  conflictStatus?: ConflictStatus;
  conflictResolution?: string;
  hasNameIssue: boolean;
  nameReviewStatus?: NameReviewStatus;
  streetSummary: string;
  importTime: string;
  reviewTime?: string;
  summaryTime?: string;
  operator: string;
  calculationMeta?: CalculationMeta;
  conflictPoints?: ConflictPoint[];
  operationLogs?: OperationLog[];
}

export interface DuplicateItem {
  redLineNo: string;
  count: number;
  recordIds: string[];
  importTimes: string[];
}

export interface NameIssueItem {
  recordId: string;
  redLineNo: string;
  newName: string;
  oldName: string;
  address: string;
  confidence: number;
}

export interface RecalcItem {
  recordId: string;
  redLineNo: string;
  beforeValue: string;
  afterValue: string;
  field: string;
  changedAt: string;
}

export interface ExportConsistencyItem {
  field: string;
  pageValue: string;
  apiValue: string;
  exportValue: string;
  isConsistent: boolean;
}

export interface SelfCheckResult {
  duplicateImport: DuplicateItem[];
  communityNameIssue: NameIssueItem[];
  recalcConsistency: RecalcItem[];
  exportConsistency: ExportConsistencyItem[];
  checkTime: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

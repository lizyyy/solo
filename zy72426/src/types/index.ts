export type RecordStatus = 'pending' | 'reviewing' | 'confirmed' | 'exception';

export type CheckType = 'duplicate_import' | 'name_mapping' | 'recalculation' | 'export_consistency';

export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

export interface ManualChange {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  operator: string;
  timestamp: number;
  reason?: string;
}

export interface SongRecord {
  id: string;
  originalRowNumber: number;
  liveName: string;
  copyrightName: string;
  emotionTag: string;
  emotionConfidence: number;
  emotionUpdatedAt: number;
  status: RecordStatus;
  audioNote: string;
  manualChanges: ManualChange[];
  groupId?: string;
  importVersion: string;
  createdAt: number;
  updatedAt: number;
}

export interface SongGroup {
  id: string;
  canonicalName: string;
  memberIds: string[];
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface CheckIssue {
  id: string;
  severity: 'warning' | 'error';
  description: string;
  recordIds: string[];
  resolved: boolean;
}

export interface SelfCheckResult {
  checkType: CheckType;
  passed: boolean;
  issueCount: number;
  issues: CheckIssue[];
  checkedAt: number;
}

export interface ImportLog {
  id: string;
  fileName: string;
  recordCount: number;
  importVersion: string;
  operator: string;
  timestamp: number;
}

export interface ImportPreviewRow {
  originalRowNumber: number;
  liveName: string;
  copyrightName: string;
  isDuplicate: boolean;
  isNameMapping: boolean;
}

export const EMOTION_TAGS = [
  '欢快', '激昂', '温柔', '感伤', '平静',
  '神秘', '紧张', '浪漫', '励志', '怀旧'
] as const;

export type EmotionTag = typeof EMOTION_TAGS[number];

export interface ChangeLogEntry {
  id: string;
  timestamp: number;
  operator: string;
  action: 'import' | 'update_record' | 'confirm_group' | 'reject_group' | 'recalculate' | 'clear_data' | 'export';
  description: string;
  affectedRecordIds: string[];
  dataHashAfter: string;
  details?: Record<string, unknown>;
}

export interface ExportSnapshot {
  id: string;
  timestamp: number;
  exportType: 'csv' | 'excel' | 'weekly_report';
  operator: string;
  dataHash: string;
  recordCount: number;
  fileName: string;
  previewRows: string[];
}

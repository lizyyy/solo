export enum ProcessingStatus {
  PENDING_REVIEW = 'pending_review',
  NORMAL = 'normal',
  ABNORMAL = 'abnormal',
  NEEDS_TEACHER_REVIEW = 'needs_teacher_review',
}

export enum WorkflowStep {
  INITIAL_IMPORT = 'initial_import',
  ENGINEER_MESSAGE_ADDED = 'engineer_message_added',
  WEEKLY_REPORT_UPDATED = 'weekly_report_updated',
}

export interface SongInfo {
  liveName: string;
  copyrightName: string;
  hasDualNames: boolean;
}

export interface ManualChange {
  changedBy: string;
  changedAt: Date;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface ConflictRecord {
  id: string;
  importBatchId: string;
  originalRowNumber: number;
  song: SongInfo;
  band: string;
  conflictDescription: string;
  processingStatus: ProcessingStatus;
  workflowStep: WorkflowStep;
  engineerMessage?: string;
  manualChanges: ManualChange[];
  createdAt: Date;
  updatedAt: Date;
  importedBy: string;
  isRolledBack: boolean;
}

export interface ImportBatch {
  id: string;
  importedBy: string;
  importedAt: Date;
  recordIds: string[];
  source: string;
  isRolledBack: boolean;
  rolledBackAt?: Date;
  rolledBackBy?: string;
  rollbackReason?: string;
}

export interface WeeklyReportVersion {
  id: string;
  createdAt: Date;
  createdBy: string;
  recordIds: string[];
  summary: string;
  totalCount: number;
  normalCount: number;
  pendingCount: number;
  abnormalCount: number;
  teacherReviewCount: number;
  content: string;
}

export interface ConflictRecordStore {
  records: ConflictRecord[];
  importBatches: ImportBatch[];
  reportVersions: WeeklyReportVersion[];
  currentReportVersionId?: string;
}

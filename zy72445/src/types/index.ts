export enum ApprovalStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REWORK_REQUIRED = 'rework_required',
  NORMAL = 'normal'
}

export enum WorkflowStep {
  ALIAS_IMPORT = 'alias_import',
  PHOTO_REVIEW = 'photo_review',
  REHEARSAL_UPDATE = 'rehearsal_update'
}

export enum DisplayMode {
  LIST = 'list',
  CHART = 'chart',
  THREE_D = 'three_d'
}

export enum ImportItemCategory {
  NEW_RECORD = 'new_record',
  THIS_TIME_DUPLICATE = 'this_time_duplicate',
  HISTORICAL_DUPLICATE = 'historical_duplicate'
}

export interface TrackAlias {
  id: string;
  trackId: string;
  trackName: string;
  aliases: string[];
  importBatchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackRemark {
  id: string;
  trackId: string;
  content: string;
  hasReworkReason: boolean;
  reworkReason?: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ClassCheckinPhoto {
  id: string;
  classSessionId: string;
  trackId?: string;
  photoUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface RehearsalChangeRecord {
  id: string;
  trackId: string;
  changeType: string;
  changeContent: string;
  createdAt: string;
  createdBy: string;
}

export interface ApprovalRecord {
  id: string;
  trackId: string;
  status: ApprovalStatus;
  currentStep: WorkflowStep;
  displayMode: DisplayMode;
  reviewedBy?: string;
  reviewedAt?: string;
  remarks: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeHistory {
  id: string;
  entityType: 'track_alias' | 'track_remark' | 'approval_record' | 'rehearsal_change';
  entityId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  changeReason?: string;
  importBatchId?: string;
  affectedEntityType?: 'approval_record' | 'track_alias';
  affectedEntityId?: string;
  snapshotId?: string;
}

export interface ImportBatch {
  id: string;
  batchIdentifier: string;
  importedAt: string;
  importedBy: string;
  trackCount: number;
  status: 'processing' | 'completed' | 'failed' | 'rolled_back';
}

export interface ImportItemDetail {
  trackId: string;
  trackName: string;
  aliases: string[];
  category: ImportItemCategory;
  existingBatchId?: string;
  existingBatchIdentifier?: string;
  newRecordId?: string;
}

export interface Snapshot {
  id: string;
  approvalId: string;
  step: WorkflowStep;
  status: ApprovalStatus;
  trackRemarkSnapshots: Array<{
    id: string;
    content: string;
    hasReworkReason: boolean;
    reworkReason?: string;
  }>;
  importBatchId?: string;
  createdAt: string;
  createdBy: string;
}

export interface ReworkApplication {
  id: string;
  approvalId: string;
  trackId: string;
  reason: string;
  appliedBy: string;
  appliedAt: string;
  previousStatus: ApprovalStatus;
  status: 'pending_review' | 'approved' | 'rejected';
}

export interface HumanReadableError {
  message: string;
  suggestion: string;
  fieldName?: string;
  originalError?: string;
}

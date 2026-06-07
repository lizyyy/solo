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
  createdAt: string;
  updatedAt: string;
}

export interface ChangeHistory {
  id: string;
  entityType: 'track_alias' | 'track_remark' | 'approval_record';
  entityId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  changeReason?: string;
}

export interface ImportBatch {
  id: string;
  batchIdentifier: string;
  importedAt: string;
  importedBy: string;
  trackCount: number;
  status: 'processing' | 'completed' | 'failed';
}

export interface HumanReadableError {
  message: string;
  suggestion: string;
  fieldName?: string;
  originalError?: string;
}

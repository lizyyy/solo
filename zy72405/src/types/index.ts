export type RecordStatus =
  | 'pending'
  | 'alias_mapped'
  | 'review_needed'
  | 'confirmed'
  | 'reviewed'
  | 'rejected';

export interface ContractSnapshot {
  id: string;
  fileHash: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  contentFingerprint: string;
}

export interface ShortageRecord {
  id: string;
  snapshotId: string;
  originalLineNumber: number;
  originalContent: string;
  trackName: string;
  standardTrackName?: string;
  shortageQuantity: number;
  status: RecordStatus;
  currentNote: string;
  isBoundaryCase: boolean;
  boundaryType?: string;
  confirmedBy?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  changedAt: string;
  changeReason: string;
}

export interface TrackAlias {
  id: string;
  standardName: string;
  aliasName: string;
  addedAt: string;
  addedBy: string;
}

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  detectionLogic: string;
  handlingGuide: string;
  rollbackGuide: string;
  example: string;
}

export interface ImportPreviewItem {
  lineNumber: number;
  content: string;
  trackName: string;
  quantity: number;
  isDuplicate: boolean;
  existingRecordId?: string;
}

export interface ParsedContractLine {
  lineNumber: number;
  content: string;
  trackName: string;
  quantity: number;
}

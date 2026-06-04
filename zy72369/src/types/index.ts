export interface Nameplate {
  id: string;
  equipmentCode: string;
  fiberType: string;
  coreDiameter: number;
  claddingDiameter: number;
  minBendRadius: number;
  importTime: string;
  isLocked: boolean;
  source: 'nameplate' | 'screenshot';
}

export type Direction = '+' | '-' | '向左' | '向右';

export type RecordStatus = 'normal' | 'conflict' | 'pending_review' | 'reviewed';

export interface BendLossRecord {
  id: string;
  nameplateId: string;
  bendRadius: number;
  direction: Direction;
  lossValue: number;
  recordTime: string;
  operator: string;
  screenshotIds: string[];
  status: RecordStatus;
  isSupplementary: boolean;
  supplementaryNote?: string;
  reviewConclusion?: string;
  reviewer?: string;
}

export type ConflictStatus = 'pending' | 'confirmed_nameplate' | 'confirmed_screenshot' | 'rejected';

export interface ConflictEntry {
  id: string;
  recordId: string;
  nameplateValue: string;
  screenshotValue: string;
  nameplateEvidence: string;
  screenshotEvidence: string;
  status: ConflictStatus;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface ScreenshotAttachment {
  id: string;
  recordId: string;
  dataUrl: string;
  note: string;
  uploadTime: string;
  uploader: string;
}

export type AuditAction = 'import' | 'create' | 'supplementary' | 'conflict_detected' | 'conflict_resolved' | 'review' | 'selfcheck';

export interface AuditLog {
  id: string;
  recordId: string;
  action: AuditAction;
  detail: string;
  operator: string;
  timestamp: string;
}

export type SelfCheckType = 'duplicate_import' | 'negative_direction' | 'supplementary_recalc' | 'export_consistency';

export interface SelfCheckResult {
  type: SelfCheckType;
  passed: boolean;
  message: string;
  details: string[];
}

export type UserRole = 'equipment_engineer' | 'field_worker' | 'lab_teacher';

export interface CurrentUser {
  role: UserRole;
  name: string;
}

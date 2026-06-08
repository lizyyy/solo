export type MaterialType = 'normal' | 'wrong_caliber' | 'supplementary';
export type WorkflowStatus = 'step1' | 'step2' | 'step3' | 'pending_review' | 'confirmed' | 'rejected';
export type CoordinateType = 'latlng' | 'metric';
export type ConflictType = 'photo_cad_mismatch' | 'duplicate_import';
export type ConflictStatus = 'pending' | 'resolved';
export type ConflictResolution = 'confirm' | 'reject';

export interface Coordinate {
  type: CoordinateType;
  lat?: number;
  lng?: number;
  metricX?: number;
  metricY?: number;
}

export interface PipelineRecord {
  id: string;
  photoNumber: string;
  cadLayer?: string;
  materialType: MaterialType;
  status: WorkflowStatus;
  siteInstruction?: string;
  coordinate: Coordinate;
  isCoordinateMixed?: boolean;
  resolutionNote?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface HistoryEntry {
  id: string;
  recordId: string;
  action: 'import' | 'update_cad' | 'resolve_conflict' | 'update_instruction' | 'review_coordinate';
  operator: string;
  timestamp: string;
  changes: ChangeEntry[];
  evidence?: string;
}

export interface ConflictEvidence {
  description: string;
  photoValue: unknown;
  cadValue: unknown;
}

export interface Conflict {
  id: string;
  recordId: string;
  type: ConflictType;
  evidence: ConflictEvidence[];
  status: ConflictStatus;
  resolution?: ConflictResolution;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface SelfCheckIssue {
  recordId: string;
  photoNumber: string;
  detail: string;
  count?: number;
}

export interface SelfCheckCategory {
  passed: boolean;
  issues: SelfCheckIssue[];
}

export interface SelfCheckReport {
  id: string;
  timestamp: string;
  checks: {
    duplicateImport: SelfCheckCategory;
    coordinateMixed: SelfCheckCategory;
    supplementaryRecalc: SelfCheckCategory;
    exportConsistency: SelfCheckCategory;
  };
  overallPassed: boolean;
}

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  normal: '正常材料',
  wrong_caliber: '错口径材料',
  supplementary: '补录材料',
};

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  step1: 'Step1 已导入照片',
  step2: 'Step2 已补录CAD',
  step3: 'Step3 已填现场说明',
  pending_review: '待巡检组复核',
  confirmed: '已确认',
  rejected: '已驳回',
};

export const COORDINATE_TYPE_LABELS: Record<CoordinateType, string> = {
  latlng: '经纬度',
  metric: '米制坐标',
};

export type ProcessingStatus =
  | 'pending_import'
  | 'imported'
  | 'missing_row'
  | 'reviewed'
  | 'supplemented'
  | 'recalculated'
  | 'completed';

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  pending_import: '待导入',
  imported: '已导入',
  missing_row: '缺行待复核',
  reviewed: '安全员已复核',
  supplemented: '已补录',
  recalculated: '已重算',
  completed: '已完成',
};

export const PROCESSING_STATUS_COLORS: Record<ProcessingStatus, string> = {
  pending_import: 'bg-gray-500',
  imported: 'bg-blue-600',
  missing_row: 'bg-orange-500',
  reviewed: 'bg-yellow-500',
  supplemented: 'bg-cyan-500',
  recalculated: 'bg-emerald-500',
  completed: 'bg-green-600',
};

export interface ModificationRecord {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  operator: '许工' | '安全员' | '系统';
  timestamp: number;
}

export interface CoordinateOriginRow {
  id: string;
  originalLineNumber: number;
  currentLineNumber: number;
  photoPointId: string;
  photoNumber?: string;
  coordinateX?: number;
  coordinateY?: number;
  coordinateZ?: number;
  isManuallyModified: boolean;
  modificationHistory: ModificationRecord[];
  processingStatus: ProcessingStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PhotoPoint {
  id: string;
  photoNumber: string;
  hasPoint: boolean;
  pixelX: number;
  pixelY: number;
}

export interface CoordinateTableEntry {
  id: string;
  photoPointId: string;
  x: number;
  y: number;
  z: number;
}

export interface OcclusionEntry {
  id: string;
  photoPointId: string;
  isOccluded: boolean;
  updatedAt: number;
}

export interface TraceInfo {
  importTime: number;
  modificationRecords: ModificationRecord[];
  reviewRecord?: {
    reviewer: string;
    time: number;
    comment: string;
  };
  recalculationVersions: string[];
}

export interface AnnotationRow {
  id: string;
  crackId: string;
  originalLineNumber: number;
  photoNumber: string;
  x3d: number;
  y3d: number;
  z3d: number;
  status: ProcessingStatus;
  isOccluded: boolean;
  traceInfo: TraceInfo;
  coordinateOriginRowId: string;
}

export interface CanonicalResult {
  version: string;
  generatedAt: number;
  generatedBy: string;
  rows: AnnotationRow[];
  checksum: string;
  rowCount: number;
  missingRowCount: number;
}

export type SelfCheckType =
  | 'duplicate_import'
  | 'missing_row'
  | 'recalculation'
  | 'export_consistency';

export const SELF_CHECK_LABELS: Record<SelfCheckType, string> = {
  duplicate_import: '重复导入检测',
  missing_row: '坐标表缺行检测',
  recalculation: '补录后重算校验',
  export_consistency: '导出一致性验证',
};

export interface SelfCheckResult {
  type: SelfCheckType;
  passed: boolean;
  checkedAt: number;
  details: Record<string, unknown>;
  message: string;
}

export type LogActionType =
  | 'import'
  | 'supplement'
  | 'review'
  | 'recalculate'
  | 'self_check'
  | 'export'
  | 'occlusion_update'
  | 'error';

export const ACTION_TYPE_LABELS: Record<LogActionType, string> = {
  import: '导入数据',
  supplement: '补录信息',
  review: '安全员复核',
  recalculate: '触发重算',
  self_check: '运行自检',
  export: '导出数据',
  occlusion_update: '更新遮挡',
  error: '系统错误',
};

export interface TraceEntry {
  action: string;
  operator: string;
  timestamp: number;
  details?: string;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  operator: string;
  actionType: LogActionType;
  action: string;
  message: string;
  rerunnableCommand: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  success: boolean;
  details: Record<string, unknown>;
  rowReference?: string;
  traceInfo: TraceEntry[];
}

export type WorkflowStep = 'step1_import' | 'step2_photo' | 'step3_occlusion' | 'completed';

export const WORKFLOW_STEP_LABELS: Record<WorkflowStep, string> = {
  step1_import: '第一步：导入坐标原点说明',
  step2_photo: '第二步：补看巡检照片编号',
  step3_occlusion: '第三步：更新遮挡点清单',
  completed: '流程完成',
};

export interface WorkflowState {
  currentStep: WorkflowStep;
  step1Completed: boolean;
  step2Completed: boolean;
  step3Completed: boolean;
  hasMissingRow: boolean;
  missingRowReviewed: boolean;
  startedAt: number;
  lastUpdatedAt: number;
}

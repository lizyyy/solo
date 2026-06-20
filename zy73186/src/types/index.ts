export type SessionStatus = 'draft' | 'pending' | 'computing' | 'suspended' | 'completed';

export type MaterialType = 'historical_answer' | 'boundary_sample' | 'verbal_note';

export type DiffType = 'added' | 'removed' | 'modified';

export type AuditActionType =
  | 'compute'
  | 'manual_edit'
  | 'suspend'
  | 'confirm'
  | 'reject'
  | 'generate_report'
  | 'upload_material'
  | 'resume_session'
  | 'material_upload'
  | 'material_update'
  | 'material_delete'
  | 'computation_start'
  | 'computation_complete'
  | 'session_transfer'
  | 'caliber_change_detected'
  | 'suspended_resolved';

export type SuspendedReason = 'duplicate_sample' | 'caliber_change';

export type SuspendedStatus = 'pending' | 'confirmed' | 'rejected';

export interface DiffChunk {
  type: DiffType;
  value: string;
  oldValue?: string;
}

export interface ProgressState {
  currentStep: number;
  totalSteps?: number;
  completionPercentage?: number;
  recoveryPoints?: number[];
  lastSavedAt?: number;
  lastModifiedBy?: string;
  scrollPosition?: number;
  expandedSteps?: string[];
}

export interface Session {
  id: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  currentStep: number;
  progress: ProgressState;
  title?: string;
}

export interface MaterialVersion {
  id: string;
  materialId: string;
  version: number;
  content: string;
  contentHash: string;
  diff: DiffChunk[];
  createdBy: string;
  changeDescription?: string;
  timestamp: number;
  createdAt: number;
}

export interface Material {
  id: string;
  sessionId: string;
  type: MaterialType;
  content: string;
  contentHash: string;
  version: number;
  versions: MaterialVersion[];
  hasCaliberChanged: boolean;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface UnitConversion {
  originalUnit: string;
  targetUnit: string;
  conversionFactor: number;
  intermediateValue: number;
  formula?: string;
}

export interface InputValue {
  value: number;
  unit: string;
  error?: number;
}

export interface ComputationStep {
  id: string;
  sessionId: string;
  stepOrder: number;
  formula: string;
  inputValues: Record<string, InputValue>;
  unitConversion: UnitConversion | null;
  result: number;
  resultUnit: string;
  description: string;
  manuallyModified: boolean;
  partialDerivatives?: Record<string, number>;
  errorContribution?: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface ManualEditInfo {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface DiffInfo {
  before: unknown;
  after: unknown;
  changeSummary?: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

export interface AuditLog {
  id: string;
  sessionId: string;
  computationStepId?: string;
  actionType: AuditActionType;
  operator: string;
  timestamp: number;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string;
  description?: string;
  manualEdit?: ManualEditInfo;
  diff?: DiffInfo;
  metadata?: Record<string, unknown>;
}

export interface DuplicateInfo {
  similarity: number;
  existingSessionId: string;
  existingSampleHash: string;
  newSampleHash: string;
  existingSessionTitle?: string;
}

export interface CaliberChangeInfo {
  materialName: string;
  fromVersion: number;
  toVersion: number;
  changeRate: number;
  changedBy: string;
}

export interface SuspendedResolution {
  action: 'continue' | 'reject' | 'new_session';
  resolvedBy: string;
  resolvedAt: number;
  notes: string;
}

export interface SuspendedTask {
  id: string;
  sessionId: string;
  reason: SuspendedReason;
  duplicateInfo?: DuplicateInfo;
  caliberChangeInfo?: CaliberChangeInfo;
  status: SuspendedStatus;
  description: string;
  createdBy: string;
  resolution?: SuspendedResolution;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface Citation {
  id: string;
  materialId: string;
  content: string;
  anchorText: string;
  position: number;
  location: { start: number; end: number };
}

export interface Report {
  id: string;
  sessionId: string;
  content: string;
  title: string;
  generatedBy: string;
  generatedAt: number;
  citations: Citation[];
  createdAt: number;
}

export interface ComputationResult {
  steps: ComputationStep[];
  finalResult: number;
  finalResultUnit: string;
  totalError: number;
}

export interface StoredSession {
  session: Session;
  materials: Material[];
  computationSteps: ComputationStep[];
  auditLogs: AuditLog[];
  suspendedTasks: SuspendedTask[];
  report?: Report;
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  historical_answer: '历史答案',
  boundary_sample: '边界样本',
  verbal_note: '口头说明',
};

export const STATUS_LABELS: Record<SessionStatus, string> = {
  draft: '草稿',
  pending: '待处理',
  computing: '计算中',
  suspended: '已挂起',
  completed: '已完成',
};

export const SUSPENDED_STATUS_LABELS: Record<SuspendedStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  rejected: '已驳回',
};

export const SUSPENDED_REASON_LABELS: Record<SuspendedReason, string> = {
  duplicate_sample: '重复样本',
  caliber_change: '口径变更',
};

export const ACTION_TYPE_LABELS: Record<AuditActionType, string> = {
  compute: '自动计算',
  manual_edit: '人工修改',
  suspend: '挂起任务',
  confirm: '确认挂起',
  reject: '驳回挂起',
  generate_report: '生成报告',
  upload_material: '上传材料',
  resume_session: '恢复会话',
  material_upload: '材料上传',
  material_update: '材料更新',
  material_delete: '材料删除',
  computation_start: '计算开始',
  computation_complete: '计算完成',
  session_transfer: '会话交接',
  caliber_change_detected: '检测到口径变更',
  suspended_resolved: '挂起任务已处理',
};

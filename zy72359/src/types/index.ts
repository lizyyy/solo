export interface AuditEntry {
  id: string
  recordId: string
  changedBy: 'inspector' | 'engineer' | 'system'
  changedByName: string
  changedAt: string
  field: string
  oldValue: string | number | null
  newValue: string | number | null
  reason: string | null
  action: 'import' | 'update' | 'confirm' | 'reject' | 'review_approve' | 'review_reject'
}

export interface CalibrationRecord {
  id: string
  traceId: string
  importBatchId: string
  batchNo: string
  temperatureCalibration: string
  sensorNo: string
  sensorNote: string
  mainMaterial: string
  coefficient: number
  originalCoefficient: number | null
  coefficientChangeReason: string | null
  status: 'normal' | 'conflict' | 'pending_review' | 'reviewed'
  nextHandler: 'inspector' | 'engineer' | null
  nextHandlerNote: string | null
  importedAt: string
  updatedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
}

export interface ConflictEvidence {
  id: string
  recordId: string
  field: string
  calibrationValue: string
  sensorValue: string
  severity: 'high' | 'medium'
  resolution: 'pending' | 'confirmed' | 'rejected'
  resolvedBy: string | null
  resolvedByName: 'inspector' | 'engineer' | null
  resolvedAt: string | null
  resolutionReason: string | null
}

export interface SelfCheckResult {
  id: string
  checkType: 'duplicate_import' | 'coefficient_no_reason' | 'recalc_after_patch' | 'export_consistency' | 'history_sync' | 'trace_consistency'
  passed: boolean
  detail: string
  affectedRecordIds: string[]
  checkedAt: string
}

export interface PumpSpeedCurve {
  recordId: string
  pressure: number[]
  speed: number[]
  baseSpeed: number[]
  coefficient: number
  version: number
  calculationDetail: string
}

export interface ImportBatch {
  id: string
  importedBy: string
  importedAt: string
  source: 'manual' | 'file' | 'patch'
  recordCount: number
}

export type UserRole = 'inspector' | 'engineer'

export const CHECK_TYPE_LABELS: Record<SelfCheckResult['checkType'], string> = {
  duplicate_import: '重复导入检测',
  coefficient_no_reason: '人工改系数无原因',
  recalc_after_patch: '补录后重算',
  export_consistency: '导出一致性',
  history_sync: '历史变更同步',
  trace_consistency: '可追溯主键一致',
}

export const STATUS_LABELS: Record<CalibrationRecord['status'], string> = {
  normal: '正常',
  conflict: '冲突待处理',
  pending_review: '待复核',
  reviewed: '已复核',
}

export const STATUS_COLORS: Record<CalibrationRecord['status'], string> = {
  normal: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  conflict: 'text-red-700 bg-red-50 border-red-200',
  pending_review: 'text-amber-700 bg-amber-50 border-amber-200',
  reviewed: 'text-blue-700 bg-blue-50 border-blue-200',
}

export const ACTION_LABELS: Record<AuditEntry['action'], string> = {
  import: '首次导入',
  update: '补录修改',
  confirm: '确认冲突',
  reject: '驳回冲突',
  review_approve: '复核通过',
  review_reject: '复核驳回',
}

export const ACTION_COLORS: Record<AuditEntry['action'], string> = {
  import: 'bg-steel-100 text-steel-700 border-steel-200',
  update: 'bg-amber-50 text-amber-700 border-amber-200',
  confirm: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reject: 'bg-red-50 text-red-700 border-red-200',
  review_approve: 'bg-blue-50 text-blue-700 border-blue-200',
  review_reject: 'bg-amber-50 text-amber-700 border-amber-200',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  inspector: '质检员',
  engineer: '设备工程师',
}

export const NEXT_HANDLER_LABELS: Record<NonNullable<CalibrationRecord['nextHandler']>, string> = {
  inspector: '质检员小白',
  engineer: '设备工程师',
}

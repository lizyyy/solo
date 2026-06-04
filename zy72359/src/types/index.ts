export interface CalibrationRecord {
  id: string
  batchNo: string
  temperatureCalibration: string
  sensorNo: string
  sensorNote: string
  mainMaterial: string
  coefficient: number
  originalCoefficient: number | null
  coefficientChangeReason: string | null
  status: 'normal' | 'conflict' | 'pending_review' | 'reviewed'
  importedAt: string
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
  resolvedAt: string | null
}

export interface SelfCheckResult {
  id: string
  checkType: 'duplicate_import' | 'coefficient_no_reason' | 'recalc_after_patch' | 'export_consistency'
  passed: boolean
  detail: string
  checkedAt: string
}

export interface PumpSpeedCurve {
  recordId: string
  pressure: number[]
  speed: number[]
  coefficient: number
  version: number
}

export type UserRole = 'inspector' | 'engineer'

export const CHECK_TYPE_LABELS: Record<SelfCheckResult['checkType'], string> = {
  duplicate_import: '重复导入检测',
  coefficient_no_reason: '人工改系数无原因',
  recalc_after_patch: '补录后重算',
  export_consistency: '导出一致性',
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

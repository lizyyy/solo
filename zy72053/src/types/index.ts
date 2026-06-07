export type Severity = 'none' | 'minor' | 'moderate' | 'severe' | 'critical'
export type Source = 'gis' | 'inspection' | 'excel'
export type PointStatus = 'normal' | 'anomaly' | 'exception'
export type QCIssueType = 'null_value' | 'duplicate' | 'boundary' | 'conflict' | 'invalid_format' | 'out_of_range'
export type JudgmentType = 'conflict_resolution' | 'anomaly_confirm' | 'data_correction'
export type ConflictResolution = 'pending' | 'data_side' | 'photo_side' | 'manual_override'

export interface PipeSegment {
  id: string
  name: string
  aliasGis: string
  aliasExcel: string
  aliasInspection: string
  startX: number
  startY: number
  startZ: number
  endX: number
  endY: number
  endZ: number
}

export interface CorrosionPoint {
  id: string
  pipeId: string
  x: number
  y: number
  z: number
  severity: Severity
  source: Source
  sourceFile: string
  importedAt: string
  inspectedAt: string
  status: PointStatus
  depth?: number | null
  thickness?: number | null
  description?: string
}

export interface InspectionPhoto {
  id: string
  pointId: string
  fileName: string
  description: string
  takenAt: string
  source: Source
  thumbnailUrl: string
}

export interface QCRecord {
  id: string
  pointId: string
  issueType: QCIssueType
  description: string
  status: 'open' | 'resolved'
  detectedAt: string
  photoId?: string
}

export interface JudgmentLog {
  id: string
  pointId: string
  operator: string
  judgmentType: JudgmentType
  oldValue: string
  newValue: string
  reason: string
  createdAt: string
}

export interface ConflictRecord {
  id: string
  pointId: string
  dataEvidence: string
  photoEvidence: string
  suggestion: string
  resolution: ConflictResolution
  resolvedBy?: string
  resolvedAt?: string
}

export interface FilterState {
  severity: Severity[]
  sources: Source[]
  dateRange: [string, string]
  pipeIds: string[]
  status: PointStatus[]
}

export interface FilterPreset {
  id: string
  name: string
  filters: FilterState
  createdAt: string
}

export interface ImportError {
  id: string
  rowNumber?: number
  field?: string
  value?: string
  errorType: 'missing_field' | 'invalid_format' | 'out_of_range' | 'duplicate_id' | 'unknown_pipe'
  message: string
  sourceFile: string
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  none: '#22C55E',
  minor: '#84CC16',
  moderate: '#EAB308',
  severe: '#F97316',
  critical: '#EF4444',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  none: '无腐蚀',
  minor: '轻微',
  moderate: '中等',
  severe: '较重',
  critical: '严重',
}

export const SOURCE_LABELS: Record<Source, string> = {
  gis: 'GIS',
  inspection: '巡检平板',
  excel: 'Excel',
}

export const STATUS_LABELS: Record<PointStatus, string> = {
  normal: '正常',
  anomaly: '异常',
  exception: '例外',
}

export const QC_ISSUE_LABELS: Record<QCIssueType, string> = {
  null_value: '空值',
  duplicate: '重复项',
  boundary: '边界越界',
  conflict: '冲突',
  invalid_format: '格式错误',
  out_of_range: '范围越界',
}

export const JUDGMENT_TYPE_LABELS: Record<JudgmentType, string> = {
  conflict_resolution: '冲突仲裁',
  anomaly_confirm: '异常确认',
  data_correction: '数据修正',
}

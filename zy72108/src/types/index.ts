export type StringName = 'E弦' | 'A弦' | 'D弦' | 'G弦'
export type ParameterSource = '实验表' | '照片说明' | '工况记录'
export type BatchStatus = 'pending' | 'reviewing' | 'passed' | 'anomaly'

export interface StringMeasurement {
  id: string
  recordId: string
  stringName: StringName
  standardTension: number
  measuredTension: number
  deviationRate: number
  isAnomaly: boolean
  anomalyReason: string
}

export interface EnvironmentCondition {
  id: string
  recordId: string
  temperature: number
  humidity: number
  note: string
}

export interface ParameterRecord {
  id: string
  batchId: string
  source: ParameterSource
  recordedAt: string
  sourceDescription: string
  measurements: StringMeasurement[]
  environment: EnvironmentCondition | null
}

export interface ThresholdVersion {
  id: string
  version: string
  thresholds: Record<StringName, number>
  effectiveAt: string
  changeReason: string
  changedBy: string
}

export interface Conflict {
  id: string
  batchId: string
  parameterName: string
  importValue: string
  importSource: string
  inspectionValue: string
  inspectionSource: string
  suggestion: string
}

export interface AuditLog {
  id: string
  batchId: string
  action: string
  actor: string
  timestamp: string
  thresholdVersionId: string
  thresholdVersion: string
  source: string
  reason: string
  details: Record<string, unknown>
}

export interface Batch {
  id: string
  name: string
  experimentType: string
  createdAt: string
  status: BatchStatus
  parameterRecords: ParameterRecord[]
  conflicts: Conflict[]
  auditLogs: AuditLog[]
}

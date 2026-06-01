export interface ExperimentRecord {
  id: string
  batchId: string
  timestamp: string
  temperature: number | null
  temperatureUnit: "°C" | "°F" | "unknown"
  duration: number | null
  durationUnit: "s" | "min" | "unknown"
  beanCenterTemp: number | null
  beanSurfaceTemp: number | null
  roastingLevel: string
  rawNote: string
  dataQualityFlags: DataQualityFlag[]
  conflictWithNote: boolean
  conflictDetail?: ConflictDetail
}

export interface DataQualityFlag {
  id: string
  type: "missing_value" | "mixed_unit" | "duplicate" | "threshold_exceeded"
  field: string
  message: string
  suggestedAction: string
  status: "pending" | "confirmed" | "dismissed"
}

export interface ConflictDetail {
  noteSays: string
  dataSays: string
  suggestedActions: ConflictAction[]
}

export interface ConflictAction {
  label: string
  description: string
}

export interface ThresholdVersion {
  version: number
  maxValue: number
  minValue: number
  unit: string
  changedAt: string
  changedBy: string
  reason: string
}

export interface ParameterVersion {
  version: number
  params: Record<string, number>
  changedAt: string
  changedBy: string
  reason: string
}

export interface ComputationTrace {
  id: string
  recordId: string
  batchId: string
  parameterVersion: number
  thresholdVersion: number
  steps: ComputationStep[]
  result: HeatConductionResult
  computedAt: string
}

export interface ComputationStep {
  name: string
  input: Record<string, number>
  formula: string
  output: number
  parameterVersionUsed: number
  thresholdVersionUsed: number
}

export interface HeatConductionResult {
  finalCenterTemp: number
  finalSurfaceTemp: number
  gradient: number
  isExceedingThreshold: boolean
  thresholdVersionUsed: number
  thresholdValueUsed: number
  radialProfile: number[]
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  action: string
  target: string
  oldValue: string
  newValue: string
  operator: string
  reason: string
}

export interface ComparisonSession {
  id: string
  batchId: string
  runA: ComputationTrace
  runB: ComputationTrace
  createdAt: string
}

export type QualityFlagType = DataQualityFlag["type"]

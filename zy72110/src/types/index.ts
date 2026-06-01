export type AngleUnit = 'deg' | 'rad'
export type LengthUnit = 'm' | 'cm'
export type VelocityUnit = 'm/s' | 'cm/s'
export type TimeUnit = 's' | 'ms'
export type Direction = '+' | '-'
export type RecordStatus = 'pass' | 'needs_review' | 'supplemented' | 'exception'
export type CaliberTag = 'current' | 'legacy_28m' | string
export type SourceType = 'sensor_log' | 'sensor_log_legacy' | 'experiment_table' | 'manual'

export interface CraneRecord {
  id: string
  source: SourceType
  rawData: string
  ropeLength: number
  ropeLengthUnit: LengthUnit
  swingAngle: number
  swingAngleUnit: AngleUnit
  linearVelocity: number
  velocityUnit: VelocityUnit
  timestamp: number
  sampleInterval: number
  sampleIntervalUnit: TimeUnit
  direction: Direction
  status: RecordStatus
  caliberTag: CaliberTag
  createdAt: number
  observationDuration: number
  previousSwingAngle?: number
}

export interface ValidationStep {
  id: string
  recordId: string
  checkType: 'angle_unit' | 'length_unit' | 'direction' | 'sample_interval' | 'threshold_angle' | 'threshold_damping'
  result: 'pass' | 'warn' | 'fail'
  message: string
  timestamp: number
}

export interface CalculationResult {
  id: string
  recordId: string
  period: number
  dampingRatio: number
  residualAngle: number
  gravity: number
  computedAt: number
  parameterHash: string
}

export interface AuditEntry {
  id: string
  recordId: string
  action: string
  detail: string
  timestamp: number
}

export interface Supplement {
  id: string
  recordId: string
  note: string
  addedAt: number
  deltaResidualAngle: number
  deltaExplanation: string
}

export interface RunHistory {
  id: string
  runAt: number
  parameterHash: string
  results: CalculationResult[]
  recordIds: string[]
}

export interface ThresholdConfig {
  maxSwingAngle: number
  minDampingRatio: number
  minSampleInterval: number
  maxSampleInterval: number
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  maxSwingAngle: 3,
  minDampingRatio: 0.05,
  minSampleInterval: 0.1,
  maxSampleInterval: 10,
}

export const GRAVITY = 9.81

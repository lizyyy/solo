export type SourceType = 'photo' | 'manual' | 'legacy'
export type RecordStatus = 'passed' | 'needs_review' | 'legacy_amended'
export type AuditAction = 'created' | 'validated' | 'reviewed' | 'amended' | 'appended'
export type CheckType = 'direction' | 'unit' | 'interval' | 'gap' | 'threshold'

export interface SourceInfo {
  type: SourceType
  reference: string
}

export interface ExperimentRecord {
  id: string
  timestamp: string
  springStiffness: number
  stiffnessUnit: string
  displacement: number
  displacementUnit: string
  force: number
  forceUnit: string
  direction: '+' | '-'
  source: SourceInfo
  processedAt: string
  status: RecordStatus
  reviewNote?: string
  amendedFrom?: string
}

export interface CheckResult {
  type: CheckType
  passed: boolean
  message: string
  suggestion?: string
}

export interface ValidationResult {
  recordId: string
  checks: CheckResult[]
  status: 'pass' | 'warning' | 'error'
}

export interface AuditEntry {
  id: string
  recordId: string
  action: AuditAction
  timestamp: string
  operator: string
  details: string
  previousStatus?: string
  newStatus?: string
}

export interface ValidationConfig {
  forceThresholdMax: number
  forceThresholdMin: number
  displacementThresholdMax: number
  displacementThresholdMin: number
  maxIntervalMs: number
  minIntervalMs: number
  expectedDisplacementUnit: string
  expectedForceUnit: string
  expectedStiffnessUnit: string
}

export const DEFAULT_CONFIG: ValidationConfig = {
  forceThresholdMax: 50,
  forceThresholdMin: -50,
  displacementThresholdMax: 100,
  displacementThresholdMin: -100,
  maxIntervalMs: 60000,
  minIntervalMs: 100,
  expectedDisplacementUnit: 'mm',
  expectedForceUnit: 'N',
  expectedStiffnessUnit: 'N/mm',
}

export const UNIT_ALIASES: Record<string, string> = {
  'mm': 'mm',
  'millimeter': 'mm',
  'cm': 'cm',
  'centimeter': 'cm',
  'm': 'm',
  'meter': 'm',
  'N': 'N',
  'newton': 'N',
  'kN': 'kN',
  'N/m': 'N/m',
  'N/mm': 'N/mm',
  'kN/m': 'kN/m',
}

export const UNIT_CONVERSION: Record<string, Record<string, number>> = {
  displacement: {
    'mm': 1,
    'cm': 10,
    'm': 1000,
  },
  force: {
    'N': 1,
    'kN': 1000,
  },
  stiffness: {
    'N/m': 1,
    'N/mm': 1000,
    'kN/m': 1000,
  },
}

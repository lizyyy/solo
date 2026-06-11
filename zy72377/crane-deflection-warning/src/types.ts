export interface ImportBatch {
  id: string
  label: string
  type: 'threshold' | 'nameplate' | 'sampling'
  importedAt: string
  operator: string
  recordCount: number
  checksum: string
}

export interface SafetyThresholdEntry {
  id: string
  batchId: string
  parameterName: string
  thresholdValue: number
  unit: string
  severity: 'normal' | 'warning' | 'critical'
  source: string
  importedAt: string
  parameterVersion: string
}

export interface EquipmentNameplateParam {
  id: string
  batchId: string
  parameterName: string
  ratedValue: number
  unit: string
  tolerance: number
  source: string
  importedAt: string
  parameterVersion: string
}

export interface ConflictRecord {
  id: string
  thresholdEntryId: string
  nameplateParamId: string
  parameterName: string
  thresholdValue: number
  nameplateRatedValue: number
  unit: string
  deviation: number
  deviationPercent: number
  description: string
  status: 'pending' | 'confirmed' | 'rejected'
  resolvedBy: string
  resolvedAt: string
  resolutionNote: string
  createdAt: string
}

export interface BeforeAfterSnapshot {
  field: string
  before: string
  after: string
  changedAt: string
  changedBy: string
}

export interface SamplingRecord {
  id: string
  batchId: string
  timestamp: string
  deflectionValue: number
  unit: string
  isMissingHalfHour: boolean
  missingPeriodStart: string | null
  missingPeriodEnd: string | null
  missingSource: string
  calculationResult: CalculationResult | null
  status: 'normal' | 'abnormal' | 'pending_review'
  reviewStatus: 'none' | 'pending' | 'reviewed'
  reviewer: string
  reviewedAt: string
  reviewNote: string
  beforeAfterSnapshots: BeforeAfterSnapshot[]
}

export interface CalculationResult {
  deflectionRatio: number
  safetyLevel: 'safe' | 'warning' | 'danger'
  parameterVersion: string
  tradeOffReason: string
  usedThresholdValue: number
  usedNameplateValue: number
  conflictResolution: string
  calculatedAt: string
}

export interface SelfCheckResult {
  id: string
  checkType: 'duplicate_import' | 'missing_half_hour' | 'recalc_after_supplement' | 'export_consistency'
  status: 'pass' | 'fail' | 'warning'
  message: string
  details: string
  checkedAt: string
}

export interface WorkflowStep {
  step: 1 | 2 | 3
  name: string
  status: 'not_started' | 'in_progress' | 'completed'
  completedAt: string
  operator: string
}

export interface AuditTrailEntry {
  id: string
  segment: 'threshold_source' | 'nameplate_supplement' | 'manual_confirmation'
  action: string
  operator: string
  timestamp: string
  details: string
  relatedRecordId: string
  parameterVersion: string
  batchId: string
}

export interface ExportRecord {
  id: string
  exportedAt: string
  recordCount: number
  includesMissingHalfHour: boolean
  consistencyHash: string
  format: string
  batchId: string
}

export interface UnifiedResultRow {
  recordId: string
  samplingTime: string
  deflectionValue: number
  unit: string
  isMissingHalfHour: boolean
  missingSource: string
  missingPeriod: string
  status: string
  reviewStatus: string
  reviewer: string
  reviewNote: string
  safetyLevel: string
  deflectionRatio: number
  parameterVersion: string
  tradeOffReason: string
  conflictResolution: string
  beforeAfterSnapshots: BeforeAfterSnapshot[]
}

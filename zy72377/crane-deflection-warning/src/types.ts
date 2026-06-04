export interface SafetyThresholdEntry {
  id: string
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

export interface SamplingRecord {
  id: string
  timestamp: string
  deflectionValue: number
  unit: string
  isMissingHalfHour: boolean
  missingPeriodStart: string | null
  missingPeriodEnd: string | null
  calculationResult: CalculationResult | null
  status: 'normal' | 'abnormal' | 'pending_review'
  reviewStatus: 'none' | 'pending' | 'reviewed'
  reviewer: string
  reviewedAt: string
  reviewNote: string
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
}

export interface ExportRecord {
  id: string
  exportedAt: string
  recordCount: number
  includesMissingHalfHour: boolean
  consistencyHash: string
  format: string
}

export type AppState = {
  safetyThresholds: SafetyThresholdEntry[]
  nameplateParams: EquipmentNameplateParam[]
  conflicts: ConflictRecord[]
  samplingRecords: SamplingRecord[]
  selfCheckResults: SelfCheckResult[]
  workflowSteps: WorkflowStep[]
  auditTrail: AuditTrailEntry[]
  exportRecords: ExportRecord[]
  currentOperator: string
}

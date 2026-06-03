export interface SafetyRadiusRow {
  originalRowNumber: number
  obstacleId: string
  obstacleName: string
  radius: number
  unit: string
  manualChange: string | null
  status: SafetyRowStatus
  importBatch: string
}

export type SafetyRowStatus = 'pending' | 'merged' | 'conflict' | 'confirmed'

export interface CoordinateOriginNote {
  noteId: string
  obstacleId: string
  obstacleName: string
  originDescription: string
  fieldObservation: string
  importBatch: string
}

export interface MergedObstacle {
  obstacleId: string
  namesFromRadiusTable: string[]
  namesFromOriginNote: string[]
  hasDuplicateName: boolean
  duplicateNameDetail: string | null
  radius: number | null
  unit: string
  originDescription: string
  fieldObservation: string
  originalRowNumbers: number[]
  manualChanges: ManualChangeRecord[]
  status: MergedStatus
  source: DataSource
  createdAt: number
  updatedAt: number
}

export type MergedStatus = 'pending_review' | 'confirmed' | 'anomaly'
export type DataSource = 'radius_table' | 'origin_note' | 'both'

export interface ManualChangeRecord {
  originalRowNumber: number
  field: string
  oldValue: string
  newValue: string
  changedAt: number
}

export type SelfCheckType = 'duplicate_import' | 'dual_name' | 'recalc_mismatch' | 'export_inconsistency'

export interface SelfCheckIssue {
  id: string
  type: SelfCheckType
  obstacleId: string
  detail: string
  severity: 'warning' | 'error'
  resolved: boolean
}

export interface ExportPayload {
  generatedAt: number
  totalObstacles: number
  anomalies: number
  items: ExportItem[]
  selfCheckSummary: SelfCheckSummary
}

export interface ExportItem {
  obstacleId: string
  displayName: string
  radius: number | null
  unit: string
  status: MergedStatus
  originalRowNumbers: number[]
  hasAnomaly: boolean
  anomalyDetail: string | null
}

export interface SelfCheckSummary {
  totalChecks: number
  passed: number
  warnings: number
  errors: number
}

export type WorkflowStep = 1 | 2 | 3

export type FormatType = 'percent' | 'decimal' | 'mixed'
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected'
export type CheckStatus = 'pass' | 'fail' | 'warning'
export type StepStatus = 'import' | 'boundary' | 'calculation'

export interface ValueChange {
  field: string
  before: string
  after: string
  reason: string
  operator: string
  timestamp: number
  nextOwner?: string
}

export interface QuestionnaireRow {
  id: string
  rowIndex: number
  fields: Record<string, string>
  originalFields: Record<string, string>
  remark: string
  importBatch: string
  importTime: number
  formatType: FormatType
  needsReview: boolean
  reviewOwner?: string
  reviewStatus?: 'pending' | 'reviewing' | 'released'
  valueChanges: ValueChange[]
  recalcRequired: boolean
  lastRecalcAt?: number
}

export interface BoundaryNote {
  id: string
  fieldName: string
  originalText: string
  relatedRowIds: string[]
  appliedRowIds: string[]
}

export interface ConflictRecord {
  id: string
  rowId: string
  boundaryNoteId: string
  field: string
  originalValue: string
  boundaryValue: string
  suggestedValue?: string
  status: ConflictStatus
  decidedBy?: string
  decidedAt?: number
  reason?: string
  resolvedValue?: string
  recalcTriggered?: boolean
  recalcFinished?: boolean
}

export interface CalculationDetail {
  id: string
  rowId: string
  varValue: number
  originalVarValue?: number
  displayFormat: 'percent' | 'decimal'
  displayValue: string
  originalDisplayValue?: string
  lastUpdated: number
  updatedBy: string
  recalcVersion: number
  recalcSource?: string
  released: boolean
  releasedBy?: string
  releasedAt?: number
  versionHistory: Array<{
    version: number
    varValue: number
    displayValue: string
    updatedAt: number
    updatedBy: string
    source: string
  }>
}

export interface AuditEntry {
  id: string
  entityType: 'row' | 'conflict' | 'calculation' | 'recalc' | 'export'
  entityId: string
  action: string
  operator: string
  timestamp: number
  reason: string
  affectedResults: string[]
  extra?: Record<string, unknown>
}

export interface SelfCheckResult {
  duplicateImport: CheckStatus
  formatConsistency: CheckStatus
  recalcAfterSupplement: CheckStatus
  exportConsistency: CheckStatus
  details: Record<string, string[]>
}

export interface ExportPayload {
  exportTime: string
  exportedBy: string
  rows: QuestionnaireRow[]
  boundaryNotes: BoundaryNote[]
  conflicts: ConflictRecord[]
  calculations: CalculationDetail[]
  audits: AuditEntry[]
  selfCheck: SelfCheckResult
}

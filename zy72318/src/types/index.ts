export type FormatType = 'percent' | 'decimal' | 'mixed'
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected'
export type CheckStatus = 'pass' | 'fail' | 'warning'
export type StepStatus = 'import' | 'boundary' | 'calculation'

export interface QuestionnaireRow {
  id: string
  rowIndex: number
  fields: Record<string, string>
  remark: string
  importBatch: string
  importTime: number
  formatType: FormatType
  needsReview: boolean
}

export interface BoundaryNote {
  id: string
  fieldName: string
  originalText: string
  relatedRowIds: string[]
}

export interface ConflictRecord {
  id: string
  rowId: string
  boundaryNoteId: string
  field: string
  originalValue: string
  boundaryValue: string
  status: ConflictStatus
  decidedBy?: string
  decidedAt?: number
  reason?: string
}

export interface CalculationDetail {
  id: string
  rowId: string
  varValue: number
  displayFormat: 'percent' | 'decimal'
  displayValue: string
  lastUpdated: number
  updatedBy: string
}

export interface AuditEntry {
  id: string
  entityType: 'row' | 'conflict' | 'calculation'
  entityId: string
  action: string
  operator: string
  timestamp: number
  reason: string
  affectedResults: string[]
}

export interface SelfCheckResult {
  duplicateImport: CheckStatus
  formatConsistency: CheckStatus
  recalcAfterSupplement: CheckStatus
  exportConsistency: CheckStatus
  details: Record<string, string[]>
}

export type RecordType = 'smooth' | 'mixed_currency' | 'supplementary'

export type RecordStatus =
  | 'smooth'
  | 'pending_review'
  | 'pending_confirm'
  | 'confirmed'
  | 'rejected'
  | 'completed'

export interface TaxRateRemark {
  id: string
  recordId: string
  taxRate: number
  remark: string
  sourceFile: string
  importedAt: string
  importedBy: string
}

export interface CounterFlowTail {
  id: string
  recordId: string
  tailNumber: string
  oldStandardAmount: number
  currency: string
  supplementaryAt: string
  supplementaryBy: string
}

export interface ConflictEvidence {
  id: string
  recordId: string
  taxRateRemarkValue: string
  counterFlowTailValue: string
  conflictField: string
  conflictDescription: string
  resolution: 'pending' | 'confirmed' | 'rejected'
  resolvedBy: string | null
  resolvedAt: string | null
}

export interface AuditLog {
  id: string
  recordId: string
  step: 'import_tax_rate' | 'supplementary_counter_flow' | 'conflict_resolved' | 'review_passed' | 'audit_update'
  operator: string
  role: string
  timestamp: string
  detail: string
  evidenceRef: string
}

export interface TrustRecord {
  id: string
  productName: string
  recordType: RecordType
  status: RecordStatus
  taxRateRemark: TaxRateRemark | null
  counterFlowTail: CounterFlowTail | null
  waterlineAmount: number
  currency: string
  rawCurrencyText: string
  hasMixedCurrency: boolean
  hasConflict: boolean
  currentStep: number
  createdAt: string
  updatedAt: string
}

export type UserRole = 'research_assistant' | 'custody_liaison' | 'auditor'

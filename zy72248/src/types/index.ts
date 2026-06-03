export type BillStatus = 'normal' | 'wrong_caliber' | 'supplement' | 'conflict' | 'risk_review'
export type MaterialType = 'normal' | 'wrong_caliber' | 'supplement'
export type ConflictResolution = 'tax_remark' | 'counter_tail' | 'rejected'
export type RiskReviewStatus = 'pending' | 'approved' | 'rejected'
export type SupplementStep = 0 | 1 | 2 | 3
export type HistoryAction = 'import' | 'self_check' | 'conflict_resolve' | 'supplement_step' | 'risk_review' | 'export' | 'summary_update'
export type SelfCheckType = 'duplicate_import' | 'zero_with_reversal' | 'supplement_recalc' | 'export_consistency'

export interface BillItem {
  id: string
  billNo: string
  amount: number
  taxRateRemark: string
  counterTxnTailNo: string
  remark: string
  status: BillStatus
  materialType: MaterialType
  importBatch: string
  importTime: string
  isZeroWithReversal: boolean
  conflictResolved: boolean
  conflictResolution?: ConflictResolution
  riskReviewStatus?: RiskReviewStatus
  supplementStep: SupplementStep
  summaryUpdated: boolean
}

export interface ConflictEvidence {
  id: string
  billItemId: string
  field: string
  taxRateValue: string
  counterTxnValue: string
  resolved: boolean
  resolution?: ConflictResolution
  resolvedBy?: string
  resolvedAt?: string
}

export interface HistoryRecord {
  id: string
  billItemId: string
  action: HistoryAction
  operator: string
  timestamp: string
  beforeSnapshot: string
  afterSnapshot: string
  detail: string
}

export interface SelfCheckResultItem {
  billItemId: string
  billNo: string
  description: string
}

export interface SelfCheckResult {
  type: SelfCheckType
  passed: boolean
  items: SelfCheckResultItem[]
}

export interface ImportBatch {
  id: string
  time: string
  type: MaterialType
  count: number
}

export const STATUS_LABELS: Record<BillStatus, string> = {
  normal: '正常',
  wrong_caliber: '错口径',
  supplement: '补录',
  conflict: '冲突',
  risk_review: '风控待复核',
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  normal: '正常材料',
  wrong_caliber: '错口径材料',
  supplement: '补录材料',
}

export const SELF_CHECK_LABELS: Record<SelfCheckType, string> = {
  duplicate_import: '重复导入',
  zero_with_reversal: '金额为0但备注已冲正',
  supplement_recalc: '补录后重算偏差',
  export_consistency: '导出一致性',
}

export type RecordStatus = '正常' | '已冲正' | '尾差补录' | '待风控复核' | '已驳回'
export type RecordSource = '顺延说明' | '尾差调整条'
export type CaliberType = '新口径' | '旧口径'
export type ConflictResolution = '待裁决' | '已确认' | '已驳回'
export type AuditAction = '导入' | '补录' | '确认冲突' | '驳回冲突' | '风控复核'
export type RiskOpinion = '通过' | '驳回' | '待补充'
export type WorkflowStep = 1 | 2 | 3

export interface TrialRecord {
  id: string
  name: string
  amount: number
  status: RecordStatus
  remark: string
  source: RecordSource
  caliber: CaliberType
  createdAt: string
  updatedAt: string
}

export interface ConflictRecord {
  id: string
  recordId: string
  holidayEvidence: string
  adjustmentEvidence: string
  conflictField: string
  resolution: ConflictResolution
  resolvedBy: string
  resolvedAt: string
  resolveReason: string
}

export interface AuditRecord {
  id: string
  recordId: string
  operator: string
  action: AuditAction
  detail: string
  reason: string
  impactResult: string
  operatedAt: string
}

export interface RiskReview {
  id: string
  recordId: string
  reviewer: string
  opinion: RiskOpinion
  comment: string
  reviewedAt: string
}

export interface SummarySnapshot {
  id: string
  totalAmount: number
  normalCount: number
  reversedCount: number
  supplementCount: number
  riskReviewCount: number
  rejectedCount: number
  conflictCount: number
  resolvedConflictCount: number
  createdAt: string
}

export type ApproverType = "full" | "pinyin"
export type RecordStatus = "normal" | "pending_review" | "pending_supplement"
export type AuditAction = "import" | "supplement" | "correct" | "rerun" | "review" | "review_reject"

export interface AuditEntry {
  id: string
  step: string
  operator: string
  timestamp: string
  action: AuditAction
  detail: string
  beforeValue?: string | number | null
  afterValue?: string | number | null
}

export interface ReviewRecord {
  id: string
  date: string
  counterNo: string
  tailNumber: string
  taxRateRemark: string
  approver: string
  approverType: ApproverType
  status: RecordStatus
  balanceBefore: number
  balanceAfter: number | null
  balanceDiff: number | null
  correctionAmount: number | null
  correctionReason: string | null
  auditTrail: AuditEntry[]
}

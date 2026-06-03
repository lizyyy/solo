export type RecordStatus = "smooth" | "pending_review" | "supplemented" | "reviewed"

export type CurrencyType = "HKD" | "CNY" | "MIXED"

export type ChangeType =
  | "import"
  | "auto_archive"
  | "flag_review"
  | "review_approve"
  | "manual_correction"
  | "rerun"
  | "supplement"

export interface EvidenceRecord {
  id: string
  securityCode: string
  securityName: string
  amountHKD: number | null
  amountCNY: number | null
  currencyType: CurrencyType
  exDividendDate: string
  correctedExDividendDate: string | null
  status: RecordStatus
  custodianConfirmRef: string
  createdAt: string
}

export interface AuditEntry {
  id: string
  recordId: string
  fieldName: string
  oldValue: string
  newValue: string
  changeType: ChangeType
  operator: string
  timestamp: string
}

export interface OperationLog {
  id: string
  recordId: string
  action: string
  operator: string
  detail: string
  timestamp: string
}

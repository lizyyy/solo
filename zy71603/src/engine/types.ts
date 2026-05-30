export interface Invoice {
  id: string
  invoiceNo: string
  amount: number
  originalAmount?: number
  seller: string
  buyer: string
  issueDate: string
  dueDate: string
  status: "normal" | "duplicate" | "amount_mismatch"
  manualCorrection?: boolean
  manualCorrectionNote?: string
}

export interface TransferApplication {
  id: string
  transferNo: string
  invoiceIds: string[]
  totalAmount: number
  applyDate: string
  hasContract: boolean
  hasVerificationReport: boolean
  verificationAmount?: number
  verificationManualCorrected?: boolean
}

export interface BuyerConfirmation {
  id: string
  transferNo: string
  confirmDate: string | null
  confirmedAmount: number
  status: "confirmed" | "unconfirmed" | "partial"
}

export interface RepaymentFlow {
  id: string
  flowNo: string
  invoiceNo: string
  amount: number
  repayDate: string
  matched: boolean
  mismatchType?: "amount" | "wrong_invoice" | "over_payment"
}

export interface AnomalyRecord {
  id: string
  step: "creditor_check" | "confirm_status" | "repayment_match" | "summary"
  stepLabel: string
  category: string
  severity: "error" | "warning" | "info"
  sourceId: string
  sourceType: string
  description: string
  impact: string
  timestamp: string
  detail: Record<string, unknown>
}

export interface CreditorCheckResult {
  normal: number
  duplicate: number
  amountMismatch: number
  details: {
    normal: Invoice[]
    duplicate: Invoice[]
    amountMismatch: Invoice[]
  }
}

export interface ConfirmStatusResult {
  confirmed: number
  unconfirmed: number
  partial: number
  details: {
    confirmed: BuyerConfirmation[]
    unconfirmed: BuyerConfirmation[]
    partial: BuyerConfirmation[]
  }
}

export interface RepaymentMatchResult {
  matched: number
  unmatched: number
  mismatched: number
  details: {
    matched: RepaymentFlow[]
    unmatched: RepaymentFlow[]
    mismatched: RepaymentFlow[]
  }
}

export interface AnalysisResult {
  summary: {
    totalAmount: number
    confirmedAmount: number
    matchedAmount: number
    anomalyCount: number
  }
  creditorCheck: CreditorCheckResult
  confirmStatus: ConfirmStatusResult
  repaymentMatch: RepaymentMatchResult
  anomalyByType: Record<string, number>
  anomalies: AnomalyRecord[]
}

export type DetailCategory =
  | "creditor_normal"
  | "creditor_duplicate"
  | "creditor_amount_mismatch"
  | "confirm_confirmed"
  | "confirm_unconfirmed"
  | "confirm_partial"
  | "repayment_matched"
  | "repayment_unmatched"
  | "repayment_mismatched"
  | "anomaly"

export interface DetailItem {
  id: string
  label: string
  value: string
  severity?: "normal" | "warning" | "error"
  [key: string]: unknown
}

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY'

export type ReceiptStatus = 'pending' | 'allocated' | 'reviewed' | 'rejected'

export type FeeType = 'bank_fee' | 'agent_fee' | 'short_payment' | 'other'

export type AnomalyType = 'duplicate_fee' | 'exchange_rate_date' | 'short_payment_dispute' | 'mismatch'

export type AnomalySeverity = 'warning' | 'error'

export interface Receipt {
  id: string
  receiptNo: string
  receiptDate: string
  currency: Currency
  amount: number
  bankName: string
  payer: string
  remark: string
  status: ReceiptStatus
  createdAt: string
  exchangeRate?: number
  exchangeRateDate?: string
  bankFee?: number
  agentFee?: number
}

export interface Invoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  currency: Currency
  amount: number
  customer: string
  product: string
  receiptId?: string
  shortPayment?: number
  shortPaymentReason?: string
}

export interface FeeAllocation {
  id: string
  receiptId: string
  invoiceId: string
  feeType: FeeType
  amount: number
  ratio: number
  reason: string
  isManual: boolean
  createdAt: string
}

export interface AuditLog {
  id: string
  receiptId: string
  action: 'create' | 'update' | 'allocate' | 'review' | 'reject' | 'export'
  operator: string
  beforeValue?: string
  afterValue?: string
  timestamp: string
  remark: string
}

export interface Anomaly {
  id: string
  receiptId: string
  type: AnomalyType
  severity: AnomalySeverity
  description: string
  evidence: string
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: string
}

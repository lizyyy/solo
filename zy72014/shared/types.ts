export interface Settlement {
  id: string
  anchorId: string
  anchorName: string
  totalTip: number | null
  refundAmount: number | null
  shareRate: number | null
  settlementAmount: number | null
  status: 'matched' | 'needs_review' | 'overridden' | 'rolled_back'
  hasChangeHistory: boolean
  isDuplicate: boolean
  hasEmptyFields: boolean
  isFullRefund: boolean
  createdAt: string
}

export interface SettlementDetail extends Settlement {
  paymentFlow: PaymentFlow | null
  refundRequest: RefundRequest | null
  approvalEmail: ApprovalEmail | null
  handwrittenNote: string | null
  changeHistory: ChangeRecord[]
}

export interface PaymentFlow {
  transactionId: string
  amount: number
  time: string
  platform: string
}

export interface RefundRequest {
  requestId: string
  amount: number
  reason: string
  time: string
}

export interface ApprovalEmail {
  subject: string
  rawContent: string
  parsedAmount: number | null
  note: string
  receivedAt: string
}

export interface ChangeRecord {
  id: string
  field: string
  oldValue: string | null
  newValue: string
  reason: string
  operator: string
  createdAt: string
}

export type StatusFilter = 'all' | 'matched' | 'needs_review' | 'overridden' | 'rolled_back'

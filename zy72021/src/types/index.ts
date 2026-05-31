export type ReconciliationStatus = 'matched' | 'diff' | 'pending' | 'overridden' | 'conflict'
export type DataSource = 'flow' | 'contract' | 'manual'
export type ImportStrategy = 'skip' | 'update' | 'conflict'

export interface PaymentFlow {
  id: string
  flowNo: string
  amount: number | null
  payDate: string | null
  payType: string | null
  remark: string | null
}

export interface RefundRequest {
  id: string
  refundNo: string
  refundAmount: number | null
  refundDate: string | null
  status: string | null
}

export interface ApprovalMail {
  id: string
  mailSubject: string
  mailFrom: string
  mailDate: string
  mailSummary: string
}

export interface ManualNote {
  id: string
  content: string
  author: string
  createdAt: string
}

export interface ReconciliationRecord {
  id: string
  pharmacyName: string
  flowNo: string
  flowAmount: number | null
  contractAmount: number | null
  insuranceAmount: number | null
  diffAmount: number | null
  status: ReconciliationStatus
  autoVerdict: ReconciliationStatus
  manualVerdict: ReconciliationStatus | null
  verdictReason: string | null
  source: DataSource
  createdAt: string
  updatedAt: string
  paymentFlows: PaymentFlow[]
  refundRequests: RefundRequest[]
  approvalMails: ApprovalMail[]
  notes: ManualNote[]
}

export interface ImportResult {
  added: number
  skipped: number
  updated: number
  conflicts: number
  total: number
}

export const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  matched: '一致',
  diff: '差异',
  pending: '待确认',
  overridden: '已改判',
  conflict: '冲突',
}

export const SOURCE_LABELS: Record<DataSource, string> = {
  flow: '收款流水',
  contract: '合同扫描件',
  manual: '手动录入',
}

export const STRATEGY_LABELS: Record<ImportStrategy, string> = {
  skip: '跳过',
  update: '更新',
  conflict: '标记冲突',
}

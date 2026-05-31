export type ReceiptStatus = "pending" | "reviewing" | "approved" | "rejected" | "exception"

export interface TransactionField {
  value: string
  originalValue: string
  modified: boolean
  modifiedAt?: string
}

export interface Transaction {
  id: string
  receiptId: string
  fields: Record<string, TransactionField>
}

export interface StatusEvent {
  status: ReceiptStatus
  timestamp: string
  operator: string
  remark?: string
}

export interface Receipt {
  id: string
  channelName: string
  transactionNo: string
  amount: number
  status: ReceiptStatus
  frozenAmount: number
  frozenDays: number
  frozenReleased: boolean
  createdAt: string
  updatedAt: string
  transactions: Transaction[]
  statusTimeline: StatusEvent[]
  remark: string
  reportDate: string
}

export interface ChangeRecord {
  id: string
  receiptId: string
  transactionId: string
  fieldName: string
  oldValue: string
  newValue: string
  operator: string
  timestamp: string
}

export interface DailyReportRow {
  channelName: string
  transactionNo: string
  amount: number
  remark?: string
  reportDate: string
}

export interface ImportPreview {
  newRows: DailyReportRow[]
  duplicateRows: DailyReportRow[]
  errorRows: DailyReportRow[]
}

export interface ConsistencyDifference {
  receiptId: string
  receiptTransactionNo: string
  field: string
  checklistValue: string
  detailValue: string
}

export interface ConsistencyResult {
  consistent: boolean
  differences: ConsistencyDifference[]
}

export interface ExportRecord {
  id: string
  timestamp: string
  operator: string
  receiptCount: number
  receiptIds: string[]
}

export const STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: "待复核",
  reviewing: "复核中",
  approved: "已通过",
  rejected: "已驳回",
  exception: "异常",
}

export const STATUS_COLORS: Record<ReceiptStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  reviewing: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  exception: "bg-amber-50 text-amber-700",
}

export type RecordSource = "grayscale" | "quality_check" | "customer_service"
export type RecordStatus = "confirmed" | "pending" | "manual_corrected"

export interface TimelineRecord {
  id: string
  source: RecordSource
  timestamp: string
  title: string
  summary: string
  status: RecordStatus
  modifier?: string
  pendingReason?: string
  isLateAttachment?: boolean
  isDuplicate?: boolean
  tags: string[]
}

export interface ChangeEntry {
  timestamp: string
  operator: string
  fromStatus: RecordStatus
  toStatus: RecordStatus
  remark: string
}

export interface InspectionRecord {
  id: string
  sourceSystem: string
  sourceIcon: string
  promptVersion: string
  currentStatus: RecordStatus
  modifier: string
  modifiedAt: string
  pendingReason?: string
  changeHistory: ChangeEntry[]
  isLateAttachment?: boolean
  isDuplicate?: boolean
  isManualCorrection?: boolean
}

export interface WeeklyReportItem {
  id: string
  recordId: string
  category: "confirmed" | "pending" | "manual_corrected"
  processingStance: string
  summary: string
  source: RecordSource
  timestamp: string
}

export const SOURCE_LABELS: Record<RecordSource, string> = {
  grayscale: "灰度记录",
  quality_check: "质检表",
  customer_service: "客服对话",
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  confirmed: "已确认",
  pending: "待补",
  manual_corrected: "人工改过",
}

export const STATUS_COLORS: Record<RecordStatus, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  pending: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  manual_corrected: "bg-sky-500/15 text-sky-500 border-sky-500/30",
}

export const SOURCE_COLORS: Record<RecordSource, string> = {
  grayscale: "border-l-amber-500",
  quality_check: "border-l-emerald-500",
  customer_service: "border-l-sky-400",
}

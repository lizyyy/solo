export type RecordStatus = "confirmed" | "pending" | "manual_corrected"

export interface ConditionLog {
  id: string
  timestamp: string
  vibrationValue: number
  unit: string
  equipmentId: string
  status: RecordStatus
  correctionNote?: string
  attachments: Attachment[]
}

export interface ThresholdConfig {
  id: string
  parameterName: string
  warningThreshold: number
  alarmThreshold: number
  unit: string
}

export interface ThresholdEvent {
  id: string
  timestamp: string
  thresholdId: string
  actualValue: number
  level: "warning" | "alarm"
  status: RecordStatus
}

export interface MaintenanceOrder {
  id: string
  createdAt: string
  equipmentId: string
  faultDesc: string
  severity: "minor" | "major" | "critical"
  status: RecordStatus
  attachments: Attachment[]
}

export interface Attachment {
  id: string
  parentId: string
  fileName: string
  uploadedAt: string
  isLate: boolean
}

export type TimelineEvent =
  | { type: "condition"; data: ConditionLog }
  | { type: "threshold"; data: ThresholdEvent }
  | { type: "maintenance"; data: MaintenanceOrder }

export type ValidationIssueType = "normal" | "late_attachment" | "duplicate" | "manual_correction"

export interface ValidationIssue {
  recordId: string
  recordType: "condition" | "threshold" | "maintenance"
  issueType: ValidationIssueType
  message: string
}

export type HandlingTag = "continue_observe" | "need_attachment" | "manually_corrected" | "resolved"

export const HANDLING_TAG_LABELS: Record<HandlingTag, string> = {
  continue_observe: "继续观察",
  need_attachment: "需补附件",
  manually_corrected: "已人工修正",
  resolved: "已处置",
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  confirmed: "已确认",
  pending: "待补",
  manual_corrected: "人工改过",
}

export const EVENT_TYPE_LABELS = {
  condition: "工况日志",
  threshold: "阈值触发",
  maintenance: "维修单",
}

export const SEVERITY_LABELS: Record<MaintenanceOrder["severity"], string> = {
  minor: "轻微",
  major: "一般",
  critical: "严重",
}

export const THRESHOLD_LEVEL_LABELS: Record<ThresholdEvent["level"], string> = {
  warning: "预警",
  alarm: "报警",
}

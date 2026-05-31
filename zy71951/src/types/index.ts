export type RecordStatus = 'normal' | 'warning' | 'critical' | 'corrected'
export type RuleType = 'no_fly_zone' | 'data_integrity' | 'anomaly' | 'custom'
export type Severity = 'info' | 'warning' | 'critical'
export type AttachmentSource = 'original' | 'late_arrival'
export type EventType = 'judgment' | 'correction' | 'attachment_add' | 'status_change' | 'import'
export type ItemType = 'normal' | 'late_attachment' | 'duplicate' | 'manual_correction'
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ImportAction = 'accept' | 'merge' | 'reject' | 'correct'

export interface InspectionRecord {
  id: string
  towerId: string
  towerName: string
  flightDate: string
  flightTime: string
  pilotName: string
  status: RecordStatus
  judgments: Judgment[]
  attachments: Attachment[]
  corrections: Correction[]
  auditTrail: AuditEvent[]
  createdAt: string
  updatedAt: string
}

export interface Judgment {
  id: string
  recordId: string
  ruleName: string
  ruleType: RuleType
  triggeredAt: string
  matchedData: Record<string, unknown>
  conclusion: string
  reasoning: string
  suggestedAction: string
  severity: Severity
  confirmed: boolean
  confirmedBy?: string
  confirmedAt?: string
}

export interface Attachment {
  id: string
  recordId: string
  fileName: string
  fileSize: number
  fileType: string
  source: AttachmentSource
  arrivedAt: string
  filePath: string
}

export interface Correction {
  id: string
  recordId: string
  fieldName: string
  oldValue: string
  newValue: string
  reason: string
  correctedBy: string
  correctedAt: string
}

export interface AuditEvent {
  id: string
  recordId: string
  eventType: EventType
  timestamp: string
  actor: string
  description: string
  details: Record<string, unknown>
}

export interface ImportDecision {
  itemId: string
  action: ImportAction
  mergeTargetId?: string
  correctionReason?: string
}

export interface ParsedItem {
  id: string
  type: 'normal' | 'late_attachment' | 'duplicate' | 'manual_correction'
  data: Record<string, unknown>
  lateFor?: string
  duplicateOf?: string
  originalValue?: string
  correctedValue?: string
}

export interface ParsedResult {
  normalRecords: number
  lateAttachments: number
  duplicates: number
  manualCorrections: number
  items: ParsedItem[]
}

export interface ImportBatch {
  id: string
  batchName: string
  importedAt: string
  importedBy: string
  totalItems: number
  normalCount: number
  lateCount: number
  duplicateCount: number
  correctionCount: number
  status: BatchStatus
}

export interface ImportItem {
  id: string
  batchId: string
  itemType: ItemType
  data: Record<string, unknown>
  actionTaken?: string
  processedAt?: string
}

export interface RecordFilters {
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
  towerId?: string
  status?: string
  anomalyType?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface DashboardStats {
  todayInspections: number
  anomalyRate: number
  pendingCount: number
  noFlyZoneEdges: number
  recentAnomalies: AuditEvent[]
  pendingTasks: InspectionRecord[]
}

export interface ReviewData {
  summary: ReviewSummary
  records: InspectionRecord[]
  charts: ChartData[]
}

export interface ReviewSummary {
  totalFlights: number
  normalCount: number
  warningCount: number
  criticalCount: number
  correctedCount: number
  noFlyZoneEdges: number
  lateAttachmentRate: number
  duplicateRate: number
}

export interface ChartData {
  name: string
  value: number
  category?: string
}

export interface ConfirmJudgmentRequest {
  judgmentId: string
  confirmedBy: string
}

export interface CreateCorrectionRequest {
  fieldName: string
  newValue: string
  reason: string
  correctedBy: string
}

export interface GetRecordsResponse {
  records: InspectionRecord[]
  total: number
  page: number
  pageSize: number
}

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  normal: '正常',
  warning: '警告',
  critical: '严重',
  corrected: '已修正',
}

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  no_fly_zone: '禁飞区',
  data_integrity: '数据完整性',
  anomaly: '异常检测',
  custom: '自定义',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  judgment: '规则判断',
  correction: '人工更正',
  attachment_add: '附件添加',
  status_change: '状态变更',
  import: '数据导入',
}

export const ATTACHMENT_SOURCE_LABELS: Record<AttachmentSource, string> = {
  original: '原始',
  late_arrival: '晚到',
}

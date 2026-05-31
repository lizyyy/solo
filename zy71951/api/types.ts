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

export interface GetRecordsRequest {
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
  towerId?: string
  status?: string
  anomalyType?: string
}

export interface GetRecordsResponse {
  records: InspectionRecord[]
  total: number
  page: number
  pageSize: number
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

export interface JudgeRequest {
  recordId: string
  flightData: Record<string, unknown>
}

export interface JudgeResponse {
  judgments: Judgment[]
  overallStatus: RecordStatus
}

export interface ParsedItem {
  id: string
  type: ItemType
  data: Record<string, unknown>
  duplicateOf?: string
  lateFor?: string
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

export interface UploadResponse {
  batchId: string
  parsed: ParsedResult
}

export interface ImportDecision {
  itemId: string
  action: ImportAction
  mergeTargetId?: string
  correctionReason?: string
}

export interface ConfirmImportRequest {
  batchId: string
  decisions: ImportDecision[]
}

export interface GetReviewRequest {
  dateFrom: string
  dateTo: string
  towerIds?: string[]
  status?: string[]
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

export interface ReviewData {
  summary: ReviewSummary
  records: InspectionRecord[]
  charts: ChartData[]
}

export interface ChartData {
  name: string
  value: number
  category?: string
}

export interface GetAuditLogRequest {
  recordId?: string
  eventType?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface AuditLogResponse {
  events: AuditEvent[]
  total: number
}

export interface DashboardStats {
  todayInspections: number
  anomalyRate: number
  pendingCount: number
  noFlyZoneEdges: number
  recentAnomalies: AuditEvent[]
  pendingTasks: InspectionRecord[]
}

export interface RecordRow {
  id: string
  tower_id: string
  tower_name: string
  flight_date: string
  flight_time: string
  pilot_name: string
  status: RecordStatus
  created_at: string
  updated_at: string
}

export interface JudgmentRow {
  id: string
  record_id: string
  rule_name: string
  rule_type: RuleType
  triggered_at: string
  matched_data: string
  conclusion: string
  reasoning: string
  suggested_action: string
  severity: Severity
  confirmed: number
  confirmed_by: string | null
  confirmed_at: string | null
}

export interface AttachmentRow {
  id: string
  record_id: string
  file_name: string
  file_size: number
  file_type: string
  source: AttachmentSource
  arrived_at: string
  file_path: string
}

export interface CorrectionRow {
  id: string
  record_id: string
  field_name: string
  old_value: string
  new_value: string
  reason: string
  corrected_by: string
  corrected_at: string
}

export interface AuditEventRow {
  id: string
  record_id: string
  event_type: EventType
  timestamp: string
  actor: string
  description: string
  details: string
}

export interface ImportBatchRow {
  id: string
  batch_name: string
  imported_at: string
  imported_by: string
  total_items: number
  normal_count: number
  late_count: number
  duplicate_count: number
  correction_count: number
  status: BatchStatus
}

export interface ImportItemRow {
  id: string
  batch_id: string
  item_type: ItemType
  data: string
  action_taken: string | null
  processed_at: string | null
}

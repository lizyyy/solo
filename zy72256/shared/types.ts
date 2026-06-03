export type CoordinateType = 'longitude_latitude' | 'metric' | 'mixed'
export type RecordStatus = 'pending_review' | 'under_review' | 'pending_inspection' | 'corrected' | 'confirmed'
export type OperatorRole = 'instructor' | 'inspector' | 'crew'
export type AuditAction = 'import' | 'review' | 'retain' | 'correct' | 'confirm' | 'rollback' | 'update_briefing'
export type RuleCategory = 'detection' | 'correction' | 'rollback'

export interface CoordinateRecord {
  id: string
  original_line_number: number
  building_name: string
  coordinate_origin_description: string
  coordinate_type: CoordinateType
  raw_latitude: number | null
  raw_longitude: number | null
  raw_metric_x: number | null
  raw_metric_y: number | null
  status: RecordStatus
  retention_reason: string | null
  inspection_photo_id: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  record_id: string
  operator: string
  operator_role: OperatorRole
  action: AuditAction
  previous_status: string
  new_status: string
  change_detail: string
  snapshot: string
  created_at: string
}

export interface BoundaryRule {
  id: string
  category: RuleCategory
  rule_name: string
  rule_description: string
  code_reference: string
  is_active: boolean
}

export interface InspectionPhoto {
  id: string
  record_id: string
  photo_number: string
  description: string | null
  attached_at: string
  attached_by: string
}

export interface ImportResponse {
  total_rows: number
  normal_count: number
  mixed_count: number
  records: CoordinateRecord[]
}

export interface ReviewRequest {
  record_id: string
  operator: string
  inspection_photo_id: string | null
  retention_reason: string | null
  action: 'retain' | 'correct'
  corrected_type?: CoordinateType
}

export interface RollbackRequest {
  record_id: string
  target_audit_log_id: string
  operator: string
  reason: string
}

export interface StatsResponse {
  total: number
  by_type: Record<CoordinateType, number>
  by_status: Record<RecordStatus, number>
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending_review: '待复核',
  under_review: '复核中',
  pending_inspection: '待巡检组复核',
  corrected: '已修正',
  confirmed: '已确认',
}

export const TYPE_LABELS: Record<CoordinateType, string> = {
  longitude_latitude: '经纬度',
  metric: '米制坐标',
  mixed: '混合坐标',
}

export const ROLE_LABELS: Record<OperatorRole, string> = {
  instructor: '培训教官',
  inspector: '巡检组',
  crew: '现场班组',
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  import: '导入',
  review: '复核',
  retain: '保留',
  correct: '修正',
  confirm: '确认',
  rollback: '回滚',
  update_briefing: '更新说明',
}

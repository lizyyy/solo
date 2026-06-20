export type ScheduleStatus = 'pending' | 'confirmed' | 'withdrawn' | 'anomaly'

export interface Schedule {
  id: number
  pet_name: string
  pet_id: number | null
  course_name: string
  course_date: string
  duration_min: number
  trainer: string
  status: ScheduleStatus
  anomaly_reason: string
  source_id: number
  source_row: string
  confirmed_by: string
  confirmed_at: string | null
  withdrawn_at: string | null
  created_at: string
}

export type MedicalStatus = 'linked' | 'needs_review'

export interface MedicalRecord {
  id: number
  pet_name: string
  pet_id: number | null
  visit_date: string
  diagnosis: string
  treatment: string
  veterinarian: string
  linked_schedule_id: number | null
  status: MedicalStatus
  anomaly_reason: string
  source_id: number
  source_row: string
  created_at: string
}

export type LogTargetType = 'schedule' | 'alias' | 'source'
export type LogAction = 'confirm' | 'withdraw' | 'bind_alias' | 'import_csv' | 'import_medical'

export interface OperationLog {
  id: number
  target_type: LogTargetType
  target_id: number
  action: LogAction
  operator: string
  remark: string
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  operated_at: string
}

export interface SummaryStats {
  total_normal_schedules: number
  pending: number
  confirmed: number
  withdrawn: number
  anomalies: number
}

export type AnomalyKind = 'schedule' | 'medical_record'

export interface AnomalyItem {
  kind: AnomalyKind
  record: Schedule | MedicalRecord
  impact: Array<Record<string, unknown>>
}

export interface CsvImportResult {
  source_id: number
  imported: Schedule[]
  anomalies: Schedule[]
}

export interface AliasBindResult {
  pet_id: number
  alias_name: string
  canonical_name: string
  affected: {
    schedules: Schedule[]
    medical_records: MedicalRecord[]
  }
}

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  withdrawn: '已撤回',
  anomaly: '异常隔离',
}

export const LOG_ACTION_LABEL: Record<LogAction, string> = {
  confirm: '确认排程',
  withdraw: '撤回排程',
  bind_alias: '绑定别名',
  import_csv: '导入CSV',
  import_medical: '录入手写单',
}

export const MEDICAL_STATUS_LABEL: Record<MedicalStatus, string> = {
  linked: '已关联',
  needs_review: '待复核',
}

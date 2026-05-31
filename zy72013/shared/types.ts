export type RecordStatus = 'pending' | 'confirmed' | 'returned' | 'suspended'
export type ActionType = 'create' | 'rejudge' | 'rollback' | 'supplement'
export type AttachmentType = 'bank_receipt' | 'ledger' | 'screenshot' | 'explanation' | 'other'

export interface DepositRecord {
  id: string
  unit_name: string
  amount: number
  deposit_type: string
  status: RecordStatus
  source: string
  original_remark: string
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  record_id: string
  action: ActionType
  old_status: string
  new_status: string
  reason: string
  diff_summary: string
  operator: string
  created_at: string
}

export interface Attachment {
  id: string
  record_id: string
  file_name: string
  file_type: AttachmentType
  original_remark: string
  file_path: string
  created_at: string
}

export interface RecordSummary {
  confirmed_total: number
  suspended_total: number
  total_count: number
}

export interface RecordsResponse {
  data: DepositRecord[]
  summary: RecordSummary
}

export interface RecordDetailResponse {
  data: DepositRecord
  attachments: Attachment[]
  audit_logs: AuditLog[]
}

export interface RejudgeRequest {
  new_status: RecordStatus
  reason: string
}

export interface RollbackRequest {
  reason: string
}

export interface SupplementRequest {
  remark: string
}

export interface SupplementResponse {
  data: DepositRecord
  audit_log: AuditLog
  diff: {
    before: string
    after: string
    summary: string
  }
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  returned: '已退回',
  suspended: '挂起',
}

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  bank_receipt: '银企回单',
  ledger: '业务台账',
  screenshot: '群截图',
  explanation: '补来说明',
  other: '其他',
}

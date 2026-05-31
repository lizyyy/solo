export type EvidenceType = 'screenshot' | 'review' | 'draft'
export type ChangeType = 'new' | 'modify' | 'delete'
export type JudgmentType = 'supplementary' | 'conclusion_changed'
export type AuditStatus = 'pending' | 'confirmed' | 'rejected'

export interface EvidenceItem {
  id: string
  activityName: string
  type: EvidenceType
  timestamp: string
  content: string
  attachmentUrl?: string
  changeType?: ChangeType
  changeNote?: string
}

export interface AuditResult {
  id: string
  evidenceId: string
  judgment: JudgmentType
  reasoning: string
  nextStep: string
  status: AuditStatus
  confirmedBy?: string
  confirmedAt?: string
  confirmNote?: string
  rejectReason?: string
  correctedConclusion?: string
}

export const TYPE_LABELS: Record<EvidenceType, string> = {
  screenshot: '排行榜截图',
  review: '活动复盘',
  draft: '关卡草表',
}

export const JUDGMENT_LABELS: Record<JudgmentType, string> = {
  supplementary: '仅补材料',
  conclusion_changed: '改了结论',
}

export const STATUS_LABELS: Record<AuditStatus, string> = {
  pending: '待对账',
  confirmed: '已确认',
  rejected: '已驳回',
}

export const CHANGE_LABELS: Record<ChangeType, string> = {
  new: '新增',
  modify: '修改',
  delete: '删除',
}

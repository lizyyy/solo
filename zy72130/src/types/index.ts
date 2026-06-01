export type RecordStatus = 'smooth' | 'needs_confirmation' | 'old_standard'
export type RecordSource = 'excel' | 'audio' | 'contract' | 'chat_annotation'
export type JudgmentType = 'system_auto' | 'manual_override' | 'note_added' | 'diff_detected'

export interface RevenueRecord {
  id: string
  trackName: string
  artist: string
  revenue: number
  shareRatio: number | null
  shareAmount: number | null
  status: RecordStatus
  source: RecordSource
  originalNote: string
  currentNote: string
  attachments: string[]
  createdAt: string
  updatedAt: string
}

export interface JudgmentStep {
  id: string
  recordId: string
  step: number
  type: JudgmentType
  description: string
  result: string
  createdAt: string
}

export interface ImportResult {
  totalFiles: number
  successCount: number
  failCount: number
  failedFiles: { fileName: string; reason: string }[]
  importedRecords: RevenueRecord[]
}

export interface FilterState {
  status: RecordStatus | ''
  source: RecordSource | ''
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  smooth: '顺利',
  needs_confirmation: '待确认',
  old_standard: '旧口径',
}

export const SOURCE_LABELS: Record<RecordSource, string> = {
  excel: 'Excel',
  audio: '音频',
  contract: '合同',
  chat_annotation: '群聊批注',
}

export const JUDGMENT_TYPE_LABELS: Record<JudgmentType, string> = {
  system_auto: '系统判断',
  manual_override: '人工标注',
  note_added: '补录备注',
  diff_detected: '差异检测',
}

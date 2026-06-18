export type SourceType = 'original' | 'late_attachment' | 'supplementary_note' | 'latest_export'
export type ReviewStatus = 'pending' | 'confirmed' | 'resolved'
export type AlignmentStatus = 'aligned' | 'misaligned' | 'unchecked'
export type HandoverStatus = 'pending' | 'confirmed' | 'completed'

export interface SampleRecord {
  id: string
  bottleNumber: string
  stationName: string
  latitude: number
  longitude: number
  sampleTime: string
  parameter: string
  value: number
  unit: string
  threshold: number
  isAnomaly: boolean
  logbookPage: string
  logbookPhoto: string
  conclusion: string
  createdAt: string
  updatedAt: string
}

export interface DataSourceEntry {
  id: string
  recordId: string
  sourceType: SourceType
  description: string
  timestamp: string
  operator: string
  attachmentUrl?: string
}

export interface ChangeRecord {
  id: string
  recordId: string
  field: string
  oldValue: string
  newValue: string
  changedAt: string
  changedBy: string
  reason: string
}

export interface ReviewFlag {
  id: string
  recordId: string
  reviewReason: string
  reviewStatus: ReviewStatus
  relatedRecordId: string
  reviewerNote: string
}

export interface HandoverItem {
  id: string
  recordId: string
  alignmentStatus: AlignmentStatus
  handoverStatus: HandoverStatus
  handoverTime: string
  handoverBy: string
}

export interface LogbookEntry {
  id: string
  page: string
  description: string
  timestamp: string
  photoUrl: string
  relatedRecordIds: string[]
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  original: '原始录入',
  late_attachment: '晚到附件',
  supplementary_note: '后补备注',
  latest_export: '最新导出',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: '待复核',
  confirmed: '已确认',
  resolved: '已解决',
}

export const ALIGNMENT_STATUS_LABELS: Record<AlignmentStatus, string> = {
  aligned: '已对齐',
  misaligned: '有偏差',
  unchecked: '未检查',
}

export const HANDOVER_STATUS_LABELS: Record<HandoverStatus, string> = {
  pending: '待交接',
  confirmed: '已确认',
  completed: '已完成',
}

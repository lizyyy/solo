export type DeviationType =
  | 'threshold_crossing'
  | 'fault_sequence_error'
  | 'alarm_duplicate_confirm'
  | 'normal_deviation'

export type RecordStatus =
  | 'pending_confirmation'
  | 'pending_processing'
  | 'confirmed'
  | 'closed'

export type RecordSource =
  | 'auto_collection'
  | 'inspection'
  | 'csv_import'
  | 'manual_entry'

export interface DeviationRecord {
  id: string
  code: string
  deviationType: DeviationType
  source: RecordSource
  equipmentCode: string
  description: string
  status: RecordStatus
  discoveredAt: string
  createdBy: string
  createdAt: string
}

export interface StatusTransition {
  id: string
  recordId: string
  fromStatus: RecordStatus | null
  toStatus: RecordStatus
  operator: string
  reason: string
  operatedAt: string
}

export interface Correction {
  id: string
  recordId: string
  field: string
  oldValue: string
  newValue: string
  operator: string
  reason: string
  isRevoked: boolean
  correctedAt: string
}

export interface Review {
  id: string
  recordId: string
  reviewer: string
  result: 'pass' | 'questioned'
  reason: string
  reviewedAt: string
}

export const DEVIATION_TYPE_LABELS: Record<DeviationType, string> = {
  threshold_crossing: '阈值跨档',
  fault_sequence_error: '故障复现顺序错',
  alarm_duplicate_confirm: '报警重复确认',
  normal_deviation: '普通偏差',
}

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  pending_confirmation: '待确认',
  pending_processing: '待处理',
  confirmed: '已确认',
  closed: '已关闭',
}

export const RECORD_SOURCE_LABELS: Record<RecordSource, string> = {
  auto_collection: '自动采集',
  inspection: '巡检录入',
  csv_import: 'CSV导入',
  manual_entry: '手工录入',
}

export const ABNORMAL_TYPES: DeviationType[] = [
  'threshold_crossing',
  'fault_sequence_error',
  'alarm_duplicate_confirm',
]

export const FIELD_LABELS: Record<string, string> = {
  code: '记录编号',
  deviationType: '偏差类型',
  source: '来源',
  equipmentCode: '设备编号',
  description: '偏差描述',
  status: '当前状态',
  discoveredAt: '发现时间',
  createdBy: '创建人',
}

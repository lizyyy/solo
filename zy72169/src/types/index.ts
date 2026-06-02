export type LocationStatus = '规划中' | '施工中' | '已启用' | '暂停'
export type DataSource = '表格' | '照片' | '审批记录' | '手动补录'
export type FeedbackStatus = '待处理' | '已回复' | '已关闭'
export type PlanAction = '新增' | '保留' | '移除' | '修改'
export type OperationType = '导入' | '补录' | '归并' | '修改' | '导出'
export type MergeStatus = '已归并' | '疑似重复' | '未归并'

export interface Location {
  id: string
  originalName: string
  canonicalName: string
  address: string
  chargerCount: number
  status: LocationStatus
  source: DataSource
  sourceDetail: string
  mergeStatus: MergeStatus
  mergedIntoId: string | null
  isException: boolean
  exceptionNote: string
  rawNote: string
  createdAt: string
  updatedAt: string
}

export interface LocationAlias {
  id: string
  locationId: string
  alias: string
  source: DataSource
  recordedAt: string
}

export interface Feedback {
  id: string
  locationId: string
  content: string
  source: DataSource
  status: FeedbackStatus
  createdAt: string
}

export interface PlanVersion {
  id: string
  versionName: string
  description: string
  createdAt: string
}

export interface PlanLocation {
  id: string
  planId: string
  locationId: string
  note: string
  action: PlanAction
}

export interface Photo {
  id: string
  locationId: string
  data: string
  fileName: string
  source: DataSource
  uploadedAt: string
}

export interface OperationLog {
  id: string
  type: OperationType
  summary: string
  detail: string
  operator: string
  operatedAt: string
}

export interface MergeSuggestion {
  id: string
  locationIdA: string
  locationIdB: string
  similarity: number
  reason: string
  resolved: boolean
  accepted: boolean | null
}

export interface ImportRow {
  rowIndex: number
  raw: Record<string, string>
  parsed: Partial<Location>
  errors: string[]
  isAnomaly: boolean
}

export interface DiffEntry {
  type: 'added' | 'modified' | 'removed'
  entity: string
  id: string
  field?: string
  before?: string
  after?: string
  timestamp: string
}

export interface DataHealth {
  totalLocations: number
  mergedLocations: number
  pendingMergeLocations: number
  anomalyLocations: number
  exceptionLocations: number
  pendingFeedbacks: number
  missingFieldCount: number
  anomalyRate: number
}

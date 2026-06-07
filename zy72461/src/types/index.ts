export type RecordStatus = 'normal' | 'name_conflict' | 'data_conflict' | 'completed' | 'ramp_supplemented'

export interface SourceData {
  communityName: string
  metroStation: string
  detourRoute: string
  hasRamp: boolean
  rampCondition: string
  barrierFreeInfo: string
  sourceDate: string
}

export interface Conflict {
  id: string
  recordId: string
  fieldName: string
  fieldLabel: string
  constructionValue: string
  rampValue: string
  status: 'pending' | 'resolved_construction' | 'resolved_ramp' | 'rejected'
  resolvedBy?: string
  resolvedAt?: string
}

export interface ChangeHistory {
  id: string
  recordId: string
  operator: string
  action: string
  fieldChanged?: string
  oldValue?: string
  newValue?: string
  reason: string
  impact?: string
  changedAt: string
}

export interface DetourRecord {
  id: string
  communityName: string
  oldCommunityName?: string
  metroStation: string
  street: string
  status: RecordStatus
  constructionNotice: SourceData
  rampRecord?: SourceData
  conflicts: Conflict[]
  changeHistory: ChangeHistory[]
  finalSource?: 'construction' | 'ramp'
  reviewer?: string
  createdAt: string
  updatedAt: string
}

export interface SummaryStats {
  total: number
  normal: number
  nameConflict: number
  dataConflict: number
  rampSupplemented: number
  completed: number
}

export interface StreetSummary {
  street: string
  count: number
  records: DetourRecord[]
}

export const statusLabels: Record<RecordStatus, string> = {
  normal: '正常',
  name_conflict: '名称待复核',
  data_conflict: '口径冲突',
  completed: '已完成',
  ramp_supplemented: '坡道补录',
}

export const statusColors: Record<RecordStatus, string> = {
  normal: 'bg-green-100 text-green-800 border-green-200',
  name_conflict: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  data_conflict: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  ramp_supplemented: 'bg-orange-100 text-orange-800 border-orange-200',
}

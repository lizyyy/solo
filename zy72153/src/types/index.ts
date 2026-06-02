export interface PointLocation {
  id: string
  name: string
  district: string
  longitude: number | null
  latitude: number | null
  complaintId: string
  complaintTime: string
  approvalRef: string
  designCapacity: number | null
  actualDemand: number | null
  constructionPeriod: string
  maintenancePeriod: string
  status: 'pending' | 'merged' | 'confirmed' | 'rejected'
  sourceTrace: string
  mergeReason: string
  conflictNote: string
  mergedFrom: string[]
  createdAt: string
  updatedAt: string
}

export interface ApprovalRecord {
  id: string
  approvalRef: string
  locationName: string
  district: string
  content: string
  approvalStatus: string
  approvedAt: string
  designCapacity: number | null
  constructionPeriod: string
  maintenancePeriod: string
  sourceFile: string
}

export type MergeType = 'same_name' | 'duplicate_complaint' | 'coordinate_drift'

export interface MergeGroup {
  id: string
  mergeType: MergeType
  reason: string
  mergedIds: string[]
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: string
}

export type ConflictType = 'capacity_overflow' | 'time_conflict' | 'data_mismatch' | 'null_value' | 'boundary'

export interface ConflictItem {
  id: string
  pointId: string
  approvalId: string
  conflictType: ConflictType
  pointEvidence: string
  approvalEvidence: string
  suggestion: string
  resolution: string
  status: 'pending' | 'confirmed' | 'rejected' | 'deferred'
  createdAt: string
}

export interface PhotoAttachment {
  id: string
  pointId: string
  fileName: string
  fileType: string
  fileData: Blob
  uploadedAt: string
}

export const MERGE_TYPE_LABELS: Record<MergeType, string> = {
  same_name: '同名路口',
  duplicate_complaint: '重复投诉',
  coordinate_drift: '坐标偏移',
}

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  capacity_overflow: '容量超限',
  time_conflict: '时段冲突',
  data_mismatch: '数据不一致',
  null_value: '空值缺失',
  boundary: '边界记录',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  merged: '已归并',
  confirmed: '已确认',
  rejected: '已驳回',
  cancelled: '已取消',
  deferred: '暂缓',
}

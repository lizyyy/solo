export type PointStatus = 'completed' | 'pending_verify' | 'need_onsite'

export type PointSource = 'inspection_photo' | 'complaint' | 'old_standard'

export interface InspectionPoint {
  id: string
  intersectionName: string
  intersectionCode: string
  coordX: number
  coordY: number
  coordDrift: boolean
  coordDriftNote: string
  status: PointStatus
  source: PointSource
  category: string
  photoUrl: string
  description: string
  suggestion: string
  inspector: string | null
  inspectDate: string
}

export interface ProcessingRecord {
  id: string
  pointId: string
  action: string
  operator: string
  date: string
  oldPlan: string
  newPlan: string
  opinion: string
  isOverride: boolean
}

export interface Complaint {
  id: string
  pointId: string
  content: string
  complainant: string
  date: string
  isDuplicate: boolean
}

export const STATUS_LABELS: Record<PointStatus, string> = {
  completed: '已处理',
  pending_verify: '待核实',
  need_onsite: '需现场复看',
}

export const STATUS_COLORS: Record<PointStatus, string> = {
  completed: '#10B981',
  pending_verify: '#F97316',
  need_onsite: '#EF4444',
}

export const SOURCE_LABELS: Record<PointSource, string> = {
  inspection_photo: '巡检照片',
  complaint: '投诉',
  old_standard: '旧口径补录',
}

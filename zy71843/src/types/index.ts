export type PositionStatus = 'calibrated' | 'pending_material' | 'conclusion_changed' | 'anomaly'
export type ChangeType = 'material_supplement' | 'conclusion_change' | 'cad_manual_edit'
export type SourceType = 'route' | 'equipment_note' | 'cad_manual'
export type AnomalyCategory = 'route_early' | 'note_late' | 'cad_conflict' | 'duplicate'

export interface Project {
  id: string
  name: string
  totalPositions: number
  calibratedCount: number
  pendingCount: number
  anomalyCount: number
  lastModified: string
}

export interface LightPosition {
  id: string
  projectId: string
  code: string
  location: string
  status: PositionStatus
  source: SourceType
  currentValue: string
  originalValue: string
  routeOrder?: number
  isDuplicate?: boolean
  lastModified: string
}

export interface ChangeRecord {
  id: string
  positionId: string
  type: ChangeType
  previousValue: string
  newValue: string
  reason: string
  timestamp: string
}

export interface AnomalyNote {
  id: string
  positionId: string
  category: AnomalyCategory
  description: string
  suggestion: string
  resolved: boolean
}

export interface InspectionCheckItem {
  id: string
  projectId: string
  label: string
  passed: boolean
  detail: string
}

export interface ConsistencyIssue {
  id: string
  projectId: string
  positionId: string
  inspectionValue: string
  detailValue: string
  field: string
}

export const STATUS_LABELS: Record<PositionStatus, string> = {
  calibrated: '已校准',
  pending_material: '待补材料',
  conclusion_changed: '已改结论',
  anomaly: '异常',
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  material_supplement: '补材料',
  conclusion_change: '改结论',
  cad_manual_edit: 'CAD手工改动',
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  route: '讲解路线',
  equipment_note: '设备备注',
  cad_manual: 'CAD手工',
}

export const ANOMALY_CATEGORY_LABELS: Record<AnomalyCategory, string> = {
  route_early: '讲解路线早到',
  note_late: '设备备注晚补',
  cad_conflict: 'CAD改动冲突',
  duplicate: '模型重复摆放',
}

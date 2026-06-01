export interface Entity {
  id: string
  name: string
  alias: string[]
  coordinateSystem: string
  x: number
  y: number
  floor: number
  photoUrl: string | null
  shareRatio: number
  sourceFile: string
  importTime: string
  processTime: string
  notes: string
}

export type AnomalyType = 'coordinate_offset' | 'duplicate_name' | 'missing_photo' | 'cross_floor'
export type AnomalyStatus = 'pending' | 'confirmed' | 'ignored'

export interface Anomaly {
  id: string
  entityId: string
  type: AnomalyType
  description: string
  sourceFile: string
  detectedAt: string
  status: AnomalyStatus
}

export interface Supplement {
  id: string
  entityId: string
  originalContent: string
  supplementedContent: string
  diff: string
  supplementTime: string
}

export interface OperationLog {
  id: string
  action: 'import' | 'edit' | 'supplement' | 'mark_anomaly' | 'save_view' | 'merge_entity'
  targetId: string
  detail: string
  timestamp: string
}

export interface ViewSnapshot {
  id: string
  name: string
  zoom: number
  panX: number
  panY: number
  savedAt: string
}

export interface EquityLink {
  id: string
  sourceId: string
  targetId: string
  ratio: number
  label: string
}

export type ValidationStatus = 'normal' | 'missing' | 'invalid'
export type SourceType = 'email' | 'chat' | 'spreadsheet' | 'manual' | 'report' | 'other'
export type ConflictType = 'overlap' | 'light_obstruction' | 'path_backflow' | 'safety_violation'
export type ConflictSeverity = 'critical' | 'warning' | 'info'
export type LightType = 'point' | 'spot' | 'ambient'

export interface Source {
  id: string
  type: SourceType
  label: string
  detail: string
  importedAt: string
}

export interface Wall {
  id: string
  exhibitionId: string
  startX: number
  startY: number
  startZ: number
  endX: number
  endY: number
  endZ: number
  height: number
  sourceId: string
}

export interface Artwork {
  id: string
  exhibitionId: string
  title: string
  width: number
  height: number
  depth: number
  posX: number
  posY: number
  posZ: number
  rotY: number
  wallId: string
  sourceId: string
  validationStatus: ValidationStatus
  processingOrder: number
}

export interface Light {
  id: string
  exhibitionId: string
  type: LightType
  posX: number
  posY: number
  posZ: number
  intensity: number
  range: number
  color: string
  sourceId: string
  validationStatus: ValidationStatus
  processingOrder: number
}

export interface PathPoint {
  x: number
  y: number
  z: number
  time: number
}

export interface VisitorPath {
  id: string
  exhibitionId: string
  name: string
  points: PathPoint[]
  sourceId: string
  validationStatus: ValidationStatus
  processingOrder: number
}

export interface SafetyZone {
  id: string
  exhibitionId: string
  artworkId: string
  distance: number
  sourceId: string
}

export interface Conflict {
  id: string
  type: ConflictType
  severity: ConflictSeverity
  affectedIds: string[]
  description: string
  resolvedAt: string | null
}

export interface Exhibition {
  id: string
  name: string
  createdAt: string
}

export type ViewpointPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'free'

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
}

export const VIEWPOINT_PRESETS: Record<ViewpointPreset, CameraState> = {
  front: { position: [0, 3, 12], target: [0, 2, 0] },
  back: { position: [0, 3, -12], target: [0, 2, 0] },
  left: { position: [-12, 3, 0], target: [0, 2, 0] },
  right: { position: [12, 3, 0], target: [0, 2, 0] },
  top: { position: [0, 18, 0.1], target: [0, 0, 0] },
  free: { position: [8, 6, 8], target: [0, 2, 0] },
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  email: '邮件',
  chat: '群消息',
  spreadsheet: '表格',
  manual: '手动录入',
  report: '旧报告',
  other: '其他',
}

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  overlap: '作品重叠',
  light_obstruction: '灯光遮挡',
  path_backflow: '动线回流',
  safety_violation: '安全距离不足',
}

export const VALIDATION_STATUS_CONFIG: Record<ValidationStatus, { label: string; color: string; bg: string }> = {
  normal: { label: '正常', color: '#22c55e', bg: '#22c55e20' },
  missing: { label: '缺项', color: '#f59e0b', bg: '#f59e0b20' },
  invalid: { label: '不合理', color: '#ef4444', bg: '#ef444444' },
}

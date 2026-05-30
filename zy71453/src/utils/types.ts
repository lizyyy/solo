export interface TrajectoryPoint {
  x: number
  y: number
  z: number
  timestamp: number
  batteryLevel: number
  taskId?: string
}

export interface DataSource {
  file: string
  line: number
  rawValue?: string
}

export interface RobotTrajectory {
  id: string
  robotId: string
  points: TrajectoryPoint[]
  status: 'normal' | 'supplementary' | 'withdrawn' | 'duplicate'
  source: DataSource
}

export interface Shelf {
  id: string
  position: [number, number, number]
  size: [number, number, number]
  zoneCode: string
}

export interface NoteChange {
  timestamp: number
  oldValue: string
  newValue: string
}

export interface TaskOrder {
  id: string
  robotId: string
  type: 'pick' | 'place' | 'transfer'
  startTime: number
  endTime?: number
  status: 'normal' | 'supplementary' | 'withdrawn' | 'duplicate'
  source: DataSource
  note?: string
  noteHistory?: NoteChange[]
  missingFields?: string[]
}

export interface AuditEntry {
  timestamp: number
  operator: string
  action: 'confirm' | 'reject' | 'note'
  detail: string
}

export interface AnomalyRecord {
  id: string
  type: 'path_through_shelf' | 'battery_drop' | 'time_misalignment' | 'missing_field'
  severity: 'critical' | 'warning' | 'info'
  description: string
  relatedId: string
  relatedType: 'trajectory' | 'task'
  source: DataSource
  status: 'pending' | 'confirmed' | 'rejected'
  auditLog: AuditEntry[]
}

export interface HeatmapConfig {
  gridSize: number
  threshold: number
  opacity: number
}

export interface BatteryConfig {
  lowThreshold: number
  dropThreshold: number
}

export interface FilterState {
  statusFilter: ('normal' | 'supplementary' | 'withdrawn' | 'duplicate')[]
  robotIds: string[]
  timeRange: [number, number]
}

export type AnomalyTabType = 'all' | 'path_through_shelf' | 'battery_drop' | 'time_misalignment' | 'missing_field'

export interface Vector3D {
  x: number
  y: number
  z: number
}

export interface Segment {
  id: string
  name: string
  dimensions: {
    length: number
    width: number
    height: number
  }
  weight: number
  centerOfGravity: Vector3D
  liftingPoints: Vector3D[]
  initialPosition: Vector3D
  targetPosition: Vector3D
  color: string
  notes?: string
}

export interface Crane {
  id: string
  name: string
  position: Vector3D
  maxRadius: number
  minRadius: number
  maxHeight: number
  maxLiftCapacity: number
  capacityCurve: CapacityPoint[]
  boomLength: number
  jibLength: number
  slewSpeed: number
  hoistSpeed: number
  color: string
}

export interface CapacityPoint {
  radius: number
  capacity: number
}

export interface Obstacle {
  id: string
  name: string
  type: ObstacleType
  dimensions: {
    length: number
    width: number
    height: number
  }
  position: Vector3D
  rotation: number
  isPermanent: boolean
  color: string
  description?: string
}

export type ObstacleType = 
  | 'temporary_support' 
  | 'transport_route' 
  | 'existing_structure' 
  | 'other'

export interface TidalWindow {
  id: string
  startTime: Date
  endTime: Date
  minHeight: number
  maxHeight: number
  safeClearance: number
  description?: string
}

export interface Keyframe {
  id: string
  timestamp: number
  position: Vector3D
  rotation: Vector3D
  hookHeight: number
  boomAngle: number
  radius: number
  label?: string
}

export interface CollisionResult {
  id: string
  type: CollisionType
  severity: CollisionSeverity
  message: string
  timestamp?: number
  position?: Vector3D
  involvedObjects: string[]
  distance?: number
  recommendedAction?: string
}

export type CollisionType = 
  | 'radius_violation'
  | 'clearance_violation'
  | 'gravity_offset'
  | 'tidal_window'
  | 'obstacle_collision'
  | 'boom_sweep'
  | 'capacity_violation'
  | 'transport_blocked'

export type CollisionSeverity = 'critical' | 'warning' | 'info'

export interface ReviewComment {
  id: string
  segmentId: string
  keyframeId?: string
  author: string
  timestamp: Date
  content: string
  isResolved: boolean
  resolvedAt?: Date
  resolver?: string
}

export interface SceneState {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  segments: Segment[]
  crane: Crane
  obstacles: Obstacle[]
  tidalWindows: TidalWindow[]
  keyframes: Keyframe[]
  currentKeyframeIndex: number
  comments: ReviewComment[]
  collisionResults: CollisionResult[]
}

export interface ProjectSettings {
  unitSystem: 'metric' | 'imperial'
  defaultScale: number
  gravity: number
  safetyMargin: number
}

export interface ImportResult<T> {
  success: boolean
  data: T[]
  errors: ImportError[]
  warnings: string[]
}

export interface ImportError {
  row: number
  column: string
  message: string
}

export interface ExportOptions {
  format: 'markdown' | 'csv' | 'json'
  includeImages?: boolean
  includeComments?: boolean
  includeCollisionData?: boolean
}

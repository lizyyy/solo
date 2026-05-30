export interface PhysicsParams {
  rampAngle: number
  rampLength: number
  skateboardMass: number
  frictionCoeff: number
  airDragCoeff: number
  gravity: number
  frontalArea: number
  airDensity: number
}

export interface SampleData {
  id: string
  measuredVelocity: number
  measurementError: number
  sampleSource: string
  sampledAt: string
  recorder: string
}

export interface DataPoint {
  id: string
  timestamp: number
  position: number
  velocity: number
  potentialEnergy: number
  kineticEnergy: number
  frictionLoss: number
  airDragLoss: number
  totalEnergy: number
  acceleration: number
  normalForce: number
  frictionForce: number
  airDragForce: number
  isSupplemented: boolean
  supplementedAt?: string
  supplementedBy?: string
  supplementSource?: string
  sample?: SampleData
}

export type AnomalyType = 'angle_out_of_range' | 'energy_increase' | 'sample_spike' | 'other'

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface Anomaly {
  id: string
  type: AnomalyType
  severity: AnomalySeverity
  description: string
  timestamp: number
  detectedAt: string
  isConfirmed: boolean
  confirmedBy?: string
  confirmedAt?: string
  resolution?: string
  data?: Record<string, unknown>
}

export interface ConflictInfo {
  field: string
  oldValue: unknown
  newValue: unknown
  resolution: 'keep_old' | 'use_new' | 'manual'
}

export interface Version {
  id: string
  versionNumber: number
  parentId?: string
  changeSummary: string
  diffData: string
  createdAt: string
  createdBy: string
  importSource?: string
  importStatus: 'new' | 'duplicate' | 'update' | 'conflict'
  conflictInfo?: ConflictInfo[]
}

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'document' | 'audio' | 'video' | 'data'
  url: string
  size: number
  uploadedAt: string
  uploadedBy: string
  description?: string
}

export interface Note {
  id: string
  content: string
  type: 'student' | 'teacher' | 'analysis' | 'verbal'
  createdAt: string
  createdBy: string
  isVerbal: boolean
  relatedDataPointId?: string
}

export type SimulationStatus = 'draft' | 'completed' | 'archived'

export interface Simulation {
  id: string
  name: string
  physicsParams: PhysicsParams
  dataPoints: DataPoint[]
  anomalies: Anomaly[]
  versions: Version[]
  attachments: Attachment[]
  notes: Note[]
  status: SimulationStatus
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface ImportCheckResult {
  status: 'new' | 'duplicate' | 'update' | 'conflict'
  differences: string[]
  conflictFields: string[]
}

export interface DiffResult {
  added: string[]
  removed: string[]
  modified: string[]
}

export interface FittedCurve {
  coefficients: number[]
  rSquared: number
  equation: string
}

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

export type MaterialCategory = 'identity' | 'policy' | 'medical' | 'accident' | 'other'

export interface Material {
  id: string
  title: string
  content: string
  category: MaterialCategory
  correctSlot: string
  sourceOrigin: string
  originalNote?: string
}

export interface GameSlot {
  id: string
  label: string
  description: string
  acceptedCategories: MaterialCategory[]
}

export interface MaterialPack {
  id: string
  name: string
  source: string
  createdAt: string
  createdBy: string
  materials: Material[]
  slots: GameSlot[]
}

export type OperationType = 'place' | 'remove' | 'click'

export interface OperationLog {
  id: string
  timestamp: string
  operationType: OperationType
  materialId: string
  targetSlot?: string
  isCorrect?: boolean
  rawNote?: string
  scoreDelta?: number
  riskDelta?: number
  resourceDelta?: number
}

export interface PauseRecord {
  id: string
  pauseTime: string
  resumeTime?: string
  reason: string
  isIntentional: boolean
}

export interface SupplementNote {
  id: string
  operationId?: string
  content: string
  addedAt: string
  addedBy: string
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'completed' | 'failed'
export type FailureReason = 'rule_misunderstanding' | 'timeout'

export interface GameState {
  sessionId: string
  status: GameStatus
  score: number
  resource: number
  risk: number
  riskThreshold: number
  timeRemaining: number
  totalTime: number
  materials: Material[]
  slots: GameSlot[]
  placedMaterials: Record<string, string>
  operationLogs: OperationLog[]
  pauseRecords: PauseRecord[]
  supplementNotes: SupplementNote[]
  materialPack: MaterialPack
  studentName: string
  startTime: string
  endTime?: string
  failureReason?: FailureReason
  diagnosticDetails?: string[]
}

export interface ExportMetadata {
  exportedAt: string
  materialSource: string
  processingStartTime: string
  processingEndTime: string
  keyDecisions: string[]
  handler: string
}

export interface GameResult {
  sessionId: string
  status: 'completed' | 'failed'
  failureReason?: FailureReason
  finalScore: number
  finalResource: number
  finalRisk: number
  diagnosticDetails: string[]
  exportMetadata: ExportMetadata
  operationLogs: OperationLog[]
  pauseRecords: PauseRecord[]
  supplementNotes: SupplementNote[]
  placedMaterials: Record<string, string>
  materialPack: MaterialPack
  studentName: string
}

export interface ConfigError {
  field: string
  technicalMessage: string
  userMessage: string
}

export interface FloatingMessage {
  id: string
  text: string
  type: 'success' | 'error' | 'warning'
  x: number
  y: number
}

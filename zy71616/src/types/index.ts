export type DicePhase = 'superposition' | 'collapsing' | 'collapsed'
export type LevelType = 'superposition' | 'measurement' | 'bias'
export type ErrorCategory = 'probability' | 'measurement' | 'sample' | 'concept' | 'operation'
export type AnomalyType = 'unnormalized_probability' | 'sample_reset_error' | 'repeated_measurement' | 'other'
export type OperationType = 'roll' | 'measure' | 'change_sample' | 'reset_sample' | 'submit_answer'
export type UserRole = 'student' | 'teacher'

export interface DiceStateModel {
  phase: DicePhase
  probabilities: number[]
  collapsedValue: number | null
  measurementCount: number
  isRepeatedMeasurement: boolean
}

export interface ProbabilityBoard {
  theoretical: number[]
  experimental: number[]
  totalRolls: number
  faceCounts: number[]
  isNormalized: boolean
  normalizationError: string | null
}

export interface OperationSnapshot {
  id: string
  timestamp: number
  operationType: OperationType
  diceState: DiceStateModel
  probabilityBoard: ProbabilityBoard
  sampleSize: number
  isAnomaly: boolean
  anomalyType: AnomalyType | null
  answer?: string
}

export interface FailureFeedback {
  id: string
  recordId: string
  errorCategory: ErrorCategory
  errorDescription: string
  probabilityUpdateStatus: { before: number[]; after: number[]; delta: number[] }
  measurementState: { collapsed: boolean; repeatedCount: number }
  sampleStatistics: { size: number; mean: number; variance: number }
  replaySnapshotId: string
}

export interface DirtyDataMark {
  id: string
  snapshotId: string
  anomalyType: AnomalyType
  description: string
  manuallyConfirmed: boolean
  markedAt: number
  confirmedAt: number | null
  historyTrail: string[]
}

export interface GameRecord {
  id: string
  studentName: string
  levelId: string
  attemptCount: number
  stars: number
  passed: boolean
  startedAt: number
  completedAt: number | null
  snapshots: OperationSnapshot[]
  feedbacks: FailureFeedback[]
}

export interface StudentData {
  name: string
  role: UserRole
  createdAt: number
  records: GameRecord[]
}

export interface LevelConfig {
  id: string
  name: string
  type: LevelType
  description: string
  taskPrompt: string
  correctAnswer: string
  answerOptions: string[]
  hint: string
  starConditions: { threeStar: string; twoStar: string; oneStar: string }
}

export interface ExportMetadata {
  exportTime: string
  processingCaliber: string
  dataScope: string
  anomalyHandling: string
  version: string
  caliberHistory: { version: string; date: string; change: string }[]
}

export interface WaveCard {
  id: string
  amplitude: number
  frequency: number
  phase: number
  phaseUnit: "radian" | "degree"
  color: string
  locked: boolean
}

export interface SurfboardState {
  x: number
  y: number
  velocityX: number
  velocityY: number
  angle: number
}

export type ExceptionType = "PHASE_UNIT_ERROR" | "AMPLITUDE_OVERFLOW" | "BOUNDARY_CROSSING"
export type ExceptionResolution = "AUTO_FIXED" | "MANUAL_FIXED" | "CONFIRMED" | "CANCELLED" | null
export type ConfirmedBy = "student" | "teacher" | null

export interface BusinessException {
  id: string
  type: ExceptionType
  triggeredAt: number
  context: {
    parameterName: string
    currentValue: number
    expectedRange: [number, number]
    allWaveCards: WaveCard[]
  }
  resolution: ExceptionResolution
  beforeSnapshot: WaveCard[]
  afterSnapshot: WaveCard[]
  confirmedBy: ConfirmedBy
  confirmedAt: number | null
}

export interface Deduction {
  id: string
  reason: string
  points: number
  relatedExceptionId: string | null
  timestamp: number
  parameterSnapshot: WaveCard[]
}

export type HistoryAction =
  | "PARAM_CHANGE"
  | "ADD_CARD"
  | "REMOVE_CARD"
  | "EXCEPTION_TRIGGERED"
  | "EXCEPTION_CONFIRMED"
  | "EXCEPTION_CANCELLED"
  | "MANUAL_CONFIRM"

export interface HistoryEntry {
  id: string
  timestamp: number
  action: HistoryAction
  description: string
  beforeSnapshot: WaveCard[]
  afterSnapshot: WaveCard[]
  exceptionId: string | null
  requiresConfirmation: boolean
  confirmedAt: number | null
}

export interface ScoreState {
  total: number
  maxScore: number
  matchPercent: number
  deductions: Deduction[]
  keyChoices: { description: string; timestamp: number }[]
  suggestions: string[]
}

export interface LevelDef {
  id: string
  name: string
  description: string
  targetWave: WaveCard[]
  maxScore: number
  matchThreshold: number
}

export interface GameSession {
  levelId: string
  targetWave: WaveCard[]
  playerWave: WaveCard[]
  surfboard: SurfboardState
  score: ScoreState
  exceptions: BusinessException[]
  history: HistoryEntry[]
  isComplete: boolean
  time: number
}

export interface ClassReport {
  classCode: string
  generatedAt: number
  students: {
    name: string
    levels: {
      levelId: string
      levelName: string
      score: number
      maxScore: number
      deductions: Deduction[]
      exceptions: BusinessException[]
      suggestions: string[]
      keyChoices: { description: string; timestamp: number }[]
    }[]
  }[]
}

export interface SamplePoint {
  x: number
  y: number
}

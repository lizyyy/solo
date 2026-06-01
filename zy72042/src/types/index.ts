export type FundCategory = 'equity' | 'bond' | 'money' | 'mixed'

export interface FundAsset {
  id: string
  name: string
  category: FundCategory
  riskFactor: number
  scoreFactor: number
  costPerUnit: number
  color: string
}

export interface FundHolding {
  fundId: string
  ratio: number
}

export type LevelType = 'smooth' | 'rework' | 'boundary' | 'free'

export interface LevelConfig {
  id: string
  name: string
  type: LevelType
  description: string
  targetScore: number
  riskLimit: number
  timeLimit: number
  initialResources: number
  availableFundIds: string[]
  hint?: string
}

export type SessionStatus = 'playing' | 'paused' | 'completed' | 'failed'
export type FailReason = 'rule' | 'timeout' | 'risk' | 'resource' | null

export interface GameSession {
  id: string
  levelId: string
  status: SessionStatus
  currentScore: number
  currentRisk: number
  remainingResources: number
  remainingTime: number
  holdings: FundHolding[]
  failReason: FailReason
  failDetail: string
  startedAt: number
  completedAt: number | null
  pauseRecords: PauseRecord[]
  actions: ActionRecord[]
  exceptions: ExceptionRecord[]
}

export type ActionType = 'drag_in' | 'drag_out' | 'adjust_ratio' | 'pause' | 'resume' | 'submit'

export interface ActionRecord {
  id: string
  sessionId: string
  actionType: ActionType
  fundId: string | null
  deltaRatio: number
  scoreBefore: number
  scoreAfter: number
  riskBefore: number
  riskAfter: number
  resourcesBefore: number
  resourcesAfter: number
  timestamp: number
}

export type ExceptionType = 'misoperation' | 'boundary_score' | 'pause_interrupt' | 'dirty_data'

export interface ExceptionRecord {
  id: string
  sessionId: string
  exceptionType: ExceptionType
  description: string
  context: string
  visible: boolean
  timestamp: number
}

export interface PauseRecord {
  id: string
  timestamp: number
  reason: string
  resumedAt: number | null
  duration: number | null
}

export interface SupplementRecord {
  id: string
  sessionId: string
  note: string
  field: string
  valueBefore: string
  valueAfter: string
  supplementedAt: number
}

export type ConflictResolution = 'pending' | 'accepted_notebook' | 'accepted_import' | 'manual'

export interface ConflictRecord {
  id: string
  sessionId: string
  field: string
  notebookValue: string
  importedValue: string
  suggestion: string
  resolution: ConflictResolution
  detectedAt: number
}

export interface NotebookEntry {
  id: string
  studentName: string
  levelId: string
  issue: string
  score: number
  timestamp: number
}

export interface PortfolioCalcResult {
  score: number
  risk: number
  diversificationBonus: number
  hedgeReduction: number
  totalCost: number
}

export interface FailureDiagnosis {
  reason: FailReason
  ruleViolated: string | null
  ruleExplanation: string | null
  timeRemaining: number | null
  riskExceeded: number | null
  suggestion: string
}

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ActionToast {
  id: string
  type: ToastType
  message: string
  detail: string
  timestamp: number
}

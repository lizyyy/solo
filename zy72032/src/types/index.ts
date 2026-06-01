export type Difficulty = "入门" | "进阶" | "挑战"
export type DeductionType = "规则未理解" | "操作超时" | "选择错误"
export type FailureType = "规则未理解" | "操作偏慢"
export type RecordSource = "系统记录" | "投影补录"
export type SupplementSource = "投影补录" | "老师备注"

export interface Option {
  id: string
  label: string
  text: string
  isCorrect: boolean
  deduction?: {
    points: number
    reason: string
    type: DeductionType
  }
}

export interface Scenario {
  id: string
  customerMessage: string
  context: string
  options: Option[]
  correctOptionId: string
  timeLimit: number
  scoringRule: string
  isBoundaryCase?: boolean
}

export interface LevelPack {
  id: string
  name: string
  description: string
  difficulty: Difficulty
  scenarios: Scenario[]
  passingScore: number
  totalPossibleScore: number
}

export interface StepResult {
  scenarioId: string
  customerMessage: string
  selectedOptionId: string
  selectedOptionText: string
  correctOptionId: string
  correctOptionText: string
  isCorrect: boolean
  isBoundaryCase: boolean
  timeTaken: number
  timeLimit: number
  timedOut: boolean
  deduction?: {
    points: number
    reason: string
    type: DeductionType
  }
}

export interface PauseRecord {
  stepIndex: number
  timestamp: number
  duration: number
  reason?: string
}

export interface SupplementRecord {
  id: string
  timestamp: number
  content: string
  source: SupplementSource
  previousScore?: number
  newScore?: number
  changedFields: string[]
}

export interface TrainingRecord {
  id: string
  levelPackId: string
  levelPackName: string
  startTime: number
  endTime: number
  totalScore: number
  maxScore: number
  passed: boolean
  needsManualReview: boolean
  steps: StepResult[]
  pauses: PauseRecord[]
  supplements: SupplementRecord[]
  source: RecordSource
  failureDiagnosis?: {
    type: FailureType
    detail: string
  }
}

export type ExceptionType =
  | "主动暂停"
  | "边界分数"
  | "操作超时"
  | "规则未理解"
  | "补录调整"
  | "需人工确认"

export interface ExceptionItem {
  recordId: string
  type: ExceptionType
  stepIndex?: number
  description: string
  timestamp: number
}

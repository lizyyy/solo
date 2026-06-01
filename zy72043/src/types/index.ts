export interface RoundParameter {
  roundNumber: number
  frequency: number
  power: number
  angle: number
  temperature: number
  extra?: Record<string, unknown>
}

export interface ScoringRule {
  id: string
  condition: string
  deduction: number
  reason: string
  detail: string
}

export interface LevelConfig {
  id: string
  name: string
  description: string
  roundCount: number
  roundTimeLimit: number
  parameters: RoundParameter[]
  correctAnswers: Record<number, string>
  scoringRules: ScoringRule[]
  options: Record<number, string[]>
}

export interface ChallengeInstance {
  id: string
  levelId: string
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  totalRounds: number
  currentRound: number
  elapsedSeconds: number
  pausedAt: string | null
  createdAt: string
  completedAt: string | null
  roundTimeLimit: number
}

export interface RoundRecord {
  id: string
  challengeId: string
  roundNumber: number
  playerChoice: string | null
  correctAnswer: string
  score: number
  choiceTimestamp: string | null
  source: 'player' | 'timeout' | 'system'
  isDuplicate: boolean
}

export interface DeductionEntry {
  id: string
  roundId: string
  reason: string
  points: number
  detail: string
}

export interface AuditEntry {
  id: string
  roundId: string
  source: 'level-config' | 'player-action' | 'system-auto' | 'teacher-remark'
  processedAt: string
  operator: string
  action: string
  snapshot: Record<string, unknown>
}

export interface ChallengeState {
  instance: ChallengeInstance | null
  records: RoundRecord[]
  deductions: DeductionEntry[]
  audits: AuditEntry[]
  level: LevelConfig | null
}

export type GameStatus = 'active' | 'paused' | 'completed' | 'abandoned'

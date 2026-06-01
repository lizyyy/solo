export interface LevelParams {
  id: string
  name: string
  difficulty: 'easy' | 'medium' | 'hard'
  noteTypes: string[]
  speedMultiplier: number
  noteCount: number
  duration: number
}

export interface PlayerChoice {
  roundIndex: number
  noteId: string
  action: 'hit' | 'miss' | 'wrong'
  timestamp: number
  score: number
}

export interface SupplementaryNote {
  id: string
  roundIndex: number
  content: string
  author: string
  createdAt: number
  isSupplementary: boolean
  originalScoreSnapshot: number
}

export interface GameSession {
  id: string
  levelParams: LevelParams
  status: 'idle' | 'playing' | 'paused' | 'ended'
  currentRound: number
  startedAt: number | null
  pausedAt: number | null
  totalPausedDuration: number
  endedAt: number | null
  endReason: string
  playerChoices: PlayerChoice[]
  notes: SupplementaryNote[]
  source: string
  createdAt: number
}

export interface RoundStat {
  roundIndex: number
  score: number
  hits: number
  misses: number
  combo: number
}

export interface SettlementResult {
  sessionId: string
  totalScore: number
  grade: string
  endReason: string
  roundStats: RoundStat[]
  suggestions: string[]
  generatedAt: number
}

export interface NoteData {
  id: string
  type: string
  lane: number
  timestamp: number
  speed: number
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended'

export type ExportFormat = 'markdown' | 'text'

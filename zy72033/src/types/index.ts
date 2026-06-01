export type MatchStatus = "setup" | "playing" | "paused" | "settled" | "locked"
export type RoundStatus = "pending" | "active" | "paused" | "completed"
export type DataSource = "normal" | "projection_screen" | "manual_correction"

export interface Match {
  id: string
  name: string
  teamCount: number
  totalRounds: number
  roundDurationSec: number
  resourceLimit: number
  status: MatchStatus
  pauseReason: string
  pausedDurationSec: number
  createdAt: string
}

export interface Team {
  id: string
  matchId: string
  name: string
  totalScore: number
  hasAnomaly: boolean
  source: DataSource
  rawNote: string
}

export interface Round {
  id: string
  matchId: string
  roundNumber: number
  durationSec: number
  status: RoundStatus
  pauseReason: string
  pausedDurationSec: number
}

export interface TeamRound {
  id: string
  roundId: string
  teamId: string
  fuelChoice: number
  resourceUsed: number
  resourceRemaining: number
  deduction: number
  deductionReason: string
  isAnomaly: boolean
  anomalyNote: string
  needsConfirmation: boolean
  confirmationNote: string
  source: DataSource
  rawNote: string
}

export interface MatchData {
  match: Match
  teams: Team[]
  rounds: Round[]
  teamRounds: TeamRound[]
}

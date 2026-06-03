import { create } from "zustand"
import type { MatchData, Match, Team, Round, TeamRound, MatchStatus, RoundStatus, DataSource } from "@/types"
import { generateSampleData } from "@/utils/sampleData"
import { calculateDeduction, OPTIMAL_CHOICE } from "@/utils/deductionEngine"

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const STORAGE_KEY = "rocket-fuel-match-data"

function loadFromStorage(): MatchData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  const samples = generateSampleData()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(samples))
  return samples
}

function saveToStorage(data: MatchData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

interface MatchStore {
  matches: MatchData[]
  activeMatchId: string | null
  timerSeconds: number
  timerRunning: boolean

  load: () => void
  getAllMatches: () => MatchData[]
  getMatch: (id: string) => MatchData | undefined
  setActiveMatchId: (id: string | null) => void
  createMatch: (name: string, teamCount: number, totalRounds: number, roundDurationSec: number, resourceLimit: number) => string
  startMatch: (matchId: string) => void
  pauseMatch: (matchId: string, reason: string) => void
  resumeMatch: (matchId: string) => void
  startRound: (matchId: string, roundNumber: number) => void
  startNextRound: (matchId: string) => boolean
  submitTeamChoice: (matchId: string, roundId: string, teamId: string, fuelChoice: number, timedOut?: boolean) => void
  endRound: (matchId: string, roundId: string) => void
  settleMatch: (matchId: string) => void
  lockMatch: (matchId: string) => void
  confirmAnomaly: (matchId: string, teamRoundId: string, note: string) => void
  addProjectionRecord: (matchId: string, teamName: string, roundNumber: number, fuelChoice: number, rawNote: string) => void
  setTimer: (seconds: number) => void
  setTimerRunning: (running: boolean) => void
  decrementTimer: () => number
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  matches: [],
  activeMatchId: null,
  timerSeconds: 0,
  timerRunning: false,

  load: () => {
    const data = loadFromStorage()
    set({ matches: data })
  },

  getAllMatches: () => get().matches,

  getMatch: (id: string) => get().matches.find((m) => m.match.id === id),

  setActiveMatchId: (id) => set({ activeMatchId: id }),

  createMatch: (name, teamCount, totalRounds, roundDurationSec, resourceLimit) => {
    const matchId = uid()
    const match: Match = {
      id: matchId,
      name,
      teamCount,
      totalRounds,
      roundDurationSec,
      resourceLimit,
      status: "setup",
      pauseReason: "",
      pausedDurationSec: 0,
      createdAt: new Date().toISOString(),
    }

    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
      id: uid(),
      matchId,
      name: `${String.fromCharCode(65 + i)}组`,
      totalScore: 100,
      hasAnomaly: false,
      source: "normal" as DataSource,
      rawNote: "",
    }))

    const rounds: Round[] = Array.from({ length: totalRounds }, (_, i) => ({
      id: uid(),
      matchId,
      roundNumber: i + 1,
      durationSec: roundDurationSec,
      status: "pending" as RoundStatus,
      pauseReason: "",
      pausedDurationSec: 0,
    }))

    const teamRounds: TeamRound[] = []

    const newMatch: MatchData = { match, teams, rounds, teamRounds }
    set((state) => {
      const updated = [...state.matches, newMatch]
      saveToStorage(updated)
      return { matches: updated, activeMatchId: matchId }
    })
    return matchId
  },

  startMatch: (matchId) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        return {
          ...md,
          match: { ...md.match, status: "playing" as MatchStatus },
          rounds: md.rounds.map((r, i) =>
            i === 0 ? { ...r, status: "active" as RoundStatus } : r
          ),
        }
      })
      saveToStorage(updated)
      const match = updated.find((m) => m.match.id === matchId)
      return {
        matches: updated,
        activeMatchId: matchId,
        timerSeconds: match?.match.roundDurationSec ?? 90,
        timerRunning: true,
      }
    })
  },

  pauseMatch: (matchId, reason) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        return {
          ...md,
          match: { ...md.match, status: "paused" as MatchStatus, pauseReason: reason },
          rounds: md.rounds.map((r) =>
            r.status === "active" ? { ...r, status: "paused" as RoundStatus, pauseReason: reason } : r
          ),
        }
      })
      saveToStorage(updated)
      return { matches: updated, timerRunning: false }
    })
  },

  resumeMatch: (matchId) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        return {
          ...md,
          match: { ...md.match, status: "playing" as MatchStatus, pauseReason: "" },
          rounds: md.rounds.map((r) =>
            r.status === "paused" ? { ...r, status: "active" as RoundStatus } : r
          ),
        }
      })
      saveToStorage(updated)
      return { matches: updated, timerRunning: true }
    })
  },

  startRound: (matchId, roundNumber) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        return {
          ...md,
          rounds: md.rounds.map((r) =>
            r.roundNumber === roundNumber ? { ...r, status: "active" as RoundStatus } : r
          ),
        }
      })
      saveToStorage(updated)
      const match = updated.find((m) => m.match.id === matchId)
      return {
        matches: updated,
        timerSeconds: match?.match.roundDurationSec ?? 90,
        timerRunning: true,
      }
    })
  },

  startNextRound: (matchId) => {
    const matchData = get().matches.find((md) => md.match.id === matchId)
    if (!matchData) return false

    const completedCount = matchData.rounds.filter((r) => r.status === "completed").length
    const nextRoundNumber = completedCount + 1

    if (nextRoundNumber > matchData.match.totalRounds) {
      get().settleMatch(matchId)
      return false
    }

    get().startRound(matchId, nextRoundNumber)
    return true
  },

  submitTeamChoice: (matchId, roundId, teamId, fuelChoice, timedOut = false) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md

        const existingTrIdx = md.teamRounds.findIndex(
          (tr) => tr.roundId === roundId && tr.teamId === teamId
        )

        if (existingTrIdx >= 0) {
          return md
        }

        const team = md.teams.find((t) => t.id === teamId)
        if (!team) return md

        const previousRounds = md.teamRounds
          .filter((tr) => tr.teamId === teamId)
          .sort((a, b) => {
            const ra = md.rounds.find((r) => r.id === a.roundId)
            const rb = md.rounds.find((r) => r.id === b.roundId)
            return (rb?.roundNumber ?? 0) - (ra?.roundNumber ?? 0)
          })
        const lastRecord = previousRounds[0]
        const currentRemaining = lastRecord ? lastRecord.resourceRemaining : md.match.resourceLimit
        const resourceUsed = Math.round(fuelChoice * 0.8)
        const resourceRemaining = currentRemaining - resourceUsed

        const result = calculateDeduction(fuelChoice, resourceRemaining, timedOut, OPTIMAL_CHOICE)

        const newTr: TeamRound = {
          id: uid(),
          roundId,
          teamId,
          fuelChoice,
          resourceUsed,
          resourceRemaining,
          deduction: result.deduction,
          deductionReason: result.deductionReason,
          isAnomaly: result.isAnomaly,
          anomalyNote: result.anomalyNote,
          needsConfirmation: result.needsConfirmation,
          confirmationNote: result.confirmationNote,
          source: "normal",
          rawNote: "",
          recordedAt: new Date().toISOString(),
        }

        const newTeamRounds = [...md.teamRounds, newTr]

        const newTotalScore = newTeamRounds
          .filter((tr) => tr.teamId === teamId)
          .reduce((sum, tr) => sum + tr.deduction, 100)

        const hasAnomaly = newTeamRounds.some(
          (tr) => tr.teamId === teamId && (tr.isAnomaly || tr.needsConfirmation)
        )

        const newTeams = md.teams.map((t) =>
          t.id === teamId
            ? { ...t, totalScore: newTotalScore, hasAnomaly }
            : t
        )

        return { ...md, teamRounds: newTeamRounds, teams: newTeams }
      })
      saveToStorage(updated)
      return { matches: updated }
    })
  },

  endRound: (matchId, roundId) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        const currentRound = md.rounds.find((r) => r.id === roundId)
        if (!currentRound) return md

        const isLastRound = currentRound.roundNumber >= md.match.totalRounds

        return {
          ...md,
          rounds: md.rounds.map((r) =>
            r.id === roundId ? { ...r, status: "completed" as RoundStatus } : r
          ),
          match: isLastRound
            ? { ...md.match, status: "settled" as MatchStatus }
            : md.match,
        }
      })
      saveToStorage(updated)
      const match = updated.find((m) => m.match.id === matchId)
      const currentRound = match?.rounds.find((r) => r.id === roundId)
      const isLast = currentRound && currentRound.roundNumber >= (match?.match.totalRounds ?? 0)
      return {
        matches: updated,
        timerRunning: isLast ? false : false,
      }
    })
  },

  settleMatch: (matchId) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        return {
          ...md,
          match: { ...md.match, status: "settled" as MatchStatus },
        }
      })
      saveToStorage(updated)
      return { matches: updated, timerRunning: false }
    })
  },

  lockMatch: (matchId) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        return {
          ...md,
          match: { ...md.match, status: "locked" as MatchStatus },
        }
      })
      saveToStorage(updated)
      return { matches: updated }
    })
  },

  confirmAnomaly: (matchId, teamRoundId, note) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md
        return {
          ...md,
          teamRounds: md.teamRounds.map((tr) =>
            tr.id === teamRoundId
              ? { ...tr, needsConfirmation: false, confirmationNote: note || "已确认" }
              : tr
          ),
        }
      })
      saveToStorage(updated)
      return { matches: updated }
    })
  },

  addProjectionRecord: (matchId, teamName, roundNumber, fuelChoice, rawNote) => {
    set((state) => {
      const updated = state.matches.map((md) => {
        if (md.match.id !== matchId) return md

        let team = md.teams.find((t) => t.name === teamName)
        const round = md.rounds.find((r) => r.roundNumber === roundNumber)
        if (!round) return md

        if (!team) {
          team = {
            id: uid(),
            matchId,
            name: teamName,
            totalScore: 100,
            hasAnomaly: false,
            source: "projection_screen" as DataSource,
            rawNote,
          }
        }

        const previousRounds = md.teamRounds
          .filter((tr) => tr.teamId === team.id)
          .sort((a, b) => {
            const ra = md.rounds.find((r) => r.id === a.roundId)
            const rb = md.rounds.find((r) => r.id === b.roundId)
            return (rb?.roundNumber ?? 0) - (ra?.roundNumber ?? 0)
          })
        const lastRecord = previousRounds[0]
        const currentRemaining = lastRecord ? lastRecord.resourceRemaining : md.match.resourceLimit
        const resourceUsed = Math.round(fuelChoice * 0.8)
        const resourceRemaining = currentRemaining - resourceUsed

        const result = calculateDeduction(fuelChoice, resourceRemaining, false, OPTIMAL_CHOICE)

        const now = new Date()
        const newTr: TeamRound = {
          id: uid(),
          roundId: round.id,
          teamId: team.id,
          fuelChoice,
          resourceUsed,
          resourceRemaining,
          deduction: result.deduction,
          deductionReason: result.deductionReason,
          isAnomaly: result.isAnomaly,
          anomalyNote: result.anomalyNote,
          needsConfirmation: result.needsConfirmation,
          confirmationNote: result.confirmationNote,
          source: "projection_screen",
          rawNote,
          recordedAt: now.toISOString(),
          projectionRecordedAt: now.toISOString(),
          projectionOperator: "助教补录",
        }

        const newTeamRounds = [...md.teamRounds, newTr]
        const newTotalScore = newTeamRounds
          .filter((tr) => tr.teamId === team.id)
          .reduce((sum, tr) => sum + tr.deduction, 100)
        const hasAnomaly = newTeamRounds.some(
          (tr) => tr.teamId === team.id && (tr.isAnomaly || tr.needsConfirmation)
        )

        const teamExists = md.teams.some((t) => t.id === team.id)
        const newTeams = teamExists
          ? md.teams.map((t) =>
              t.id === team.id ? { ...t, totalScore: newTotalScore, hasAnomaly, rawNote, source: "projection_screen" as DataSource } : t
            )
          : [...md.teams, { ...team, totalScore: newTotalScore, hasAnomaly }]

        return { ...md, teamRounds: newTeamRounds, teams: newTeams }
      })
      saveToStorage(updated)
      return { matches: updated }
    })
  },

  setTimer: (seconds) => set({ timerSeconds: seconds }),
  setTimerRunning: (running) => set({ timerRunning: running }),
  decrementTimer: () => {
    const { timerSeconds } = get()
    const next = Math.max(0, timerSeconds - 1)
    set({ timerSeconds: next })
    return next
  },
}))

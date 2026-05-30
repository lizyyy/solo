import { create } from 'zustand'
import type {
  Scenario,
  PhaseConfig,
  GameResult,
  Game,
  RiskItem,
  ScenarioSummary,
  LeaderboardEntry,
  Approach,
  BusRoute,
  PedestrianCrossing,
} from '../../shared/types.js'

interface GameStore {
  playerName: string
  setPlayerName: (name: string) => void

  scenarios: ScenarioSummary[]
  currentScenario: Scenario | null
  loading: boolean
  error: string | null

  currentGameId: string | null
  phaseConfig: PhaseConfig[]
  gameResult: GameResult | null
  submitting: boolean

  games: Game[]
  leaderboard: LeaderboardEntry[]

  fetchScenarios: () => Promise<void>
  fetchScenario: (id: string) => Promise<void>
  startGame: (scenarioId: string) => Promise<void>
  updatePhases: (phases: PhaseConfig[]) => Promise<void>
  submitGame: () => Promise<void>
  fetchGameResult: (gameId: string) => Promise<void>
  fetchHistory: (playerName?: string) => Promise<void>
  fetchLeaderboard: (scenarioId?: string) => Promise<void>
  exportGame: (gameId: string) => Promise<void>
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  playerName: '',
  setPlayerName: (name) => set({ playerName: name }),

  scenarios: [],
  currentScenario: null,
  loading: false,
  error: null,

  currentGameId: null,
  phaseConfig: [],
  gameResult: null,
  submitting: false,

  games: [],
  leaderboard: [],

  fetchScenarios: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/scenarios')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ScenarioSummary[] = await res.json()
      set({ scenarios: data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchScenario: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/scenarios/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Scenario = await res.json()
      set({ currentScenario: data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  startGame: async (scenarioId) => {
    set({ loading: true, error: null })
    try {
      const { playerName } = get()
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, playerName }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { id } = await res.json()
      set({ currentGameId: id })

      const gameRes = await fetch(`/api/games/${id}`)
      if (!gameRes.ok) throw new Error(`HTTP ${gameRes.status}`)
      const game = await gameRes.json()
      set({ phaseConfig: game.phaseConfig ?? [], loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updatePhases: async (phases) => {
    set({ loading: true, error: null })
    try {
      const { currentGameId } = get()
      const res = await fetch(`/api/games/${currentGameId}/phases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseConfig: phases }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      set({ phaseConfig: phases, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  submitGame: async () => {
    set({ submitting: true, error: null })
    try {
      const { currentGameId } = get()
      const res = await fetch(`/api/games/${currentGameId}/submit`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: GameResult = await res.json()
      set({ gameResult: data, submitting: false })
    } catch (e) {
      set({ error: (e as Error).message, submitting: false })
    }
  },

  fetchGameResult: async (gameId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/games/${gameId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const game = await res.json()
      const result: GameResult = {
        gameId: game.id,
        scenarioId: game.scenarioId,
        scenarioName: game.scenarioName,
        playerName: game.playerName,
        phaseConfig: game.phaseConfig ?? [],
        vehicleScore: game.vehicleScore,
        pedestrianScore: game.pedestrianScore,
        busScore: game.busScore,
        totalScore: game.totalScore,
        passed: game.passed,
        passThreshold: game.passThreshold,
        risks: game.risks ?? [],
        winReasons: game.winReasons ?? [],
        loseReasons: game.loseReasons ?? [],
      }
      set({ gameResult: result, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchHistory: async (playerName) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (playerName) params.set('player', playerName)
      const query = params.toString()
      const url = query ? `/api/history?${query}` : '/api/history'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Game[] = await res.json()
      set({ games: data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchLeaderboard: async (scenarioId) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (scenarioId) params.set('scenarioId', scenarioId)
      const query = params.toString()
      const url = query ? `/api/history/leaderboard?${query}` : '/api/history/leaderboard'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: LeaderboardEntry[] = await res.json()
      set({ leaderboard: data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  exportGame: async (gameId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/history/${gameId}/export`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `game-${gameId}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      set({ loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  resetGame: () => {
    set({
      currentGameId: null,
      phaseConfig: [],
      gameResult: null,
      currentScenario: null,
    })
  },
}))

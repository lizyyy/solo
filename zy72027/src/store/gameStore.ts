import { create } from 'zustand'
import type { GameSession, GameStatus, LevelParams, PlayerChoice, SupplementaryNote, SettlementResult, NoteData } from '@/types'
import { createNewSession, createPlayerChoice, createSupplementaryNote, SAMPLE_SESSIONS, LEVEL_PARAMS } from '@/data/sampleData'
import { computeSettlement } from '@/utils/exportUtils'

interface GameState {
  sessions: GameSession[]
  currentSessionId: string | null
  settlements: Map<string, SettlementResult>
  availableLevels: LevelParams[]
  activeNotes: NoteData[]

  getCurrentSession: () => GameSession | null
  getCurrentSettlement: () => SettlementResult | null
  getSettlement: (sessionId: string) => SettlementResult | null

  startGame: (levelParams: LevelParams) => void
  pauseGame: () => void
  resumeGame: () => void
  restartGame: () => void
  endGame: (reason: string) => void
  addPlayerChoice: (noteId: string, action: PlayerChoice['action'], score: number) => void
  addSupplementaryNote: (roundIndex: number, content: string, author: string) => void
  spawnNote: (note: NoteData) => void
  removeNote: (noteId: string) => void
  clearActiveNotes: () => void

  loadSampleData: () => void
}

const STORAGE_KEY = 'quantum-barrage-sessions'

function loadFromStorage(): GameSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return SAMPLE_SESSIONS
}

function saveToStorage(sessions: GameSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function rebuildSettlements(sessions: GameSession[]): Map<string, SettlementResult> {
  const map = new Map<string, SettlementResult>()
  for (const s of sessions) {
    if (s.status === 'ended') {
      map.set(s.id, computeSettlement(s))
    }
  }
  return map
}

export const useGameStore = create<GameState>((set, get) => {
  const initialSessions = loadFromStorage()
  const initialSettlements = rebuildSettlements(initialSessions)

  return {
    sessions: initialSessions,
    currentSessionId: null,
    settlements: initialSettlements,
    availableLevels: LEVEL_PARAMS,
    activeNotes: [],

    getCurrentSession: () => {
      const { sessions, currentSessionId } = get()
      return sessions.find(s => s.id === currentSessionId) || null
    },

    getCurrentSettlement: () => {
      const { settlements, currentSessionId } = get()
      return currentSessionId ? settlements.get(currentSessionId) || null : null
    },

    getSettlement: (sessionId: string) => {
      return get().settlements.get(sessionId) || null
    },

    startGame: (levelParams: LevelParams) => {
      const session = createNewSession(levelParams)
      session.status = 'playing'
      session.startedAt = Date.now()
      session.currentRound = 1
      const newSessions = [session, ...get().sessions]
      saveToStorage(newSessions)
      set({ sessions: newSessions, currentSessionId: session.id, activeNotes: [] })
    },

    pauseGame: () => {
      const { sessions, currentSessionId } = get()
      if (!currentSessionId) return
      const newSessions = sessions.map(s =>
        s.id === currentSessionId && s.status === 'playing'
          ? { ...s, status: 'paused' as GameStatus, pausedAt: Date.now() }
          : s
      )
      saveToStorage(newSessions)
      set({ sessions: newSessions, activeNotes: [] })
    },

    resumeGame: () => {
      const { sessions, currentSessionId } = get()
      if (!currentSessionId) return
      const newSessions = sessions.map(s => {
        if (s.id === currentSessionId && s.status === 'paused') {
          const pauseDuration = s.pausedAt ? Date.now() - s.pausedAt : 0
          return {
            ...s,
            status: 'playing' as GameStatus,
            pausedAt: null,
            totalPausedDuration: s.totalPausedDuration + pauseDuration,
          }
        }
        return s
      })
      saveToStorage(newSessions)
      set({ sessions: newSessions })
    },

    restartGame: () => {
      const { sessions, currentSessionId } = get()
      const current = sessions.find(s => s.id === currentSessionId)
      if (!current) return
      const fresh = createNewSession(current.levelParams)
      fresh.status = 'playing'
      fresh.startedAt = Date.now()
      fresh.currentRound = 1
      const newSessions = [fresh, ...sessions]
      saveToStorage(newSessions)
      set({ sessions: newSessions, currentSessionId: fresh.id, activeNotes: [] })
    },

    endGame: (reason: string) => {
      const { sessions, currentSessionId } = get()
      if (!currentSessionId) return
      let settlement: SettlementResult | null = null
      const newSessions = sessions.map(s => {
        if (s.id === currentSessionId && (s.status === 'playing' || s.status === 'paused')) {
          let totalPaused = s.totalPausedDuration
          if (s.status === 'paused' && s.pausedAt) {
            totalPaused += Date.now() - s.pausedAt
          }
          const updated = {
            ...s,
            status: 'ended' as GameStatus,
            endedAt: Date.now(),
            endReason: reason,
            pausedAt: null,
            totalPausedDuration: totalPaused,
          }
          settlement = computeSettlement(updated)
          return updated
        }
        return s
      })
      const newSettlements = new Map(get().settlements)
      if (settlement && currentSessionId) {
        newSettlements.set(currentSessionId, settlement)
      }
      saveToStorage(newSessions)
      set({ sessions: newSessions, settlements: newSettlements, activeNotes: [] })
    },

    addPlayerChoice: (noteId: string, action: PlayerChoice['action'], score: number) => {
      const { sessions, currentSessionId } = get()
      if (!currentSessionId) return
      const newSessions = sessions.map(s => {
        if (s.id === currentSessionId && s.status === 'playing') {
          const choice = createPlayerChoice(s.currentRound, noteId, action, score)
          return {
            ...s,
            playerChoices: [...s.playerChoices, choice],
            currentRound: action === 'hit' || action === 'wrong'
              ? s.currentRound + 1
              : s.currentRound,
          }
        }
        return s
      })
      saveToStorage(newSessions)
      set({ sessions: newSessions })
    },

    addSupplementaryNote: (roundIndex: number, content: string, author: string) => {
      const { sessions, currentSessionId } = get()
      if (!currentSessionId) return
      const newSessions = sessions.map(s => {
        if (s.id === currentSessionId) {
          const roundChoices = s.playerChoices.filter(c => c.roundIndex === roundIndex)
          const roundScore = roundChoices.reduce((sum, c) => sum + c.score, 0)
          const note = createSupplementaryNote(roundIndex, content, author, roundScore)
          return {
            ...s,
            notes: [...s.notes, note],
          }
        }
        return s
      })

      const currentSession = newSessions.find(s => s.id === currentSessionId)
      let newSettlements = get().settlements
      if (currentSession && currentSession.status === 'ended') {
        newSettlements = new Map(newSettlements)
        newSettlements.set(currentSessionId, computeSettlement(currentSession))
      }

      saveToStorage(newSessions)
      set({ sessions: newSessions, settlements: newSettlements })
    },

    spawnNote: (note: NoteData) => {
      set(state => ({ activeNotes: [...state.activeNotes, note] }))
    },

    removeNote: (noteId: string) => {
      set(state => ({ activeNotes: state.activeNotes.filter(n => n.id !== noteId) }))
    },

    clearActiveNotes: () => {
      set({ activeNotes: [] })
    },

    loadSampleData: () => {
      saveToStorage(SAMPLE_SESSIONS)
      set({
        sessions: SAMPLE_SESSIONS,
        settlements: rebuildSettlements(SAMPLE_SESSIONS),
        currentSessionId: null,
        activeNotes: [],
      })
    },
  }
})

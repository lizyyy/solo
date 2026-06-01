import { create } from 'zustand'
import type { GameSession } from '@/types'

const STORAGE_KEY = 'cafe-sessions'

function readFromStorage(): GameSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeToStorage(sessions: GameSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

interface HistoryState {
  sessions: GameSession[]

  loadSessions: () => void
  saveSession: (session: GameSession) => void
  getSession: (id: string) => GameSession | undefined
  deleteSession: (id: string) => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  sessions: [],

  loadSessions() {
    set({ sessions: readFromStorage() })
  },

  saveSession(session: GameSession) {
    const { sessions } = get()
    const idx = sessions.findIndex(s => s.id === session.id)
    let updated: GameSession[]
    if (idx >= 0) {
      updated = sessions.map(s => (s.id === session.id ? session : s))
    } else {
      updated = [...sessions, session]
    }
    writeToStorage(updated)
    set({ sessions: updated })
  },

  getSession(id: string) {
    return get().sessions.find(s => s.id === id)
  },

  deleteSession(id: string) {
    const updated = get().sessions.filter(s => s.id !== id)
    writeToStorage(updated)
    set({ sessions: updated })
  },
}))

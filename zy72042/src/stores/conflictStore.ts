import { create } from 'zustand'
import type { ConflictRecord, ConflictResolution } from '@/types'

const STORAGE_KEY = 'cafe-conflicts'

function readFromStorage(): ConflictRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeToStorage(conflicts: ConflictRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conflicts))
}

interface ConflictState {
  conflicts: ConflictRecord[]

  loadConflicts: () => void
  addConflict: (conflict: ConflictRecord) => void
  resolveConflict: (id: string, resolution: ConflictResolution) => void
  getConflictsForSession: (sessionId: string) => ConflictRecord[]
}

export const useConflictStore = create<ConflictState>((set, get) => ({
  conflicts: [],

  loadConflicts() {
    set({ conflicts: readFromStorage() })
  },

  addConflict(conflict: ConflictRecord) {
    const updated = [...get().conflicts, conflict]
    writeToStorage(updated)
    set({ conflicts: updated })
  },

  resolveConflict(id: string, resolution: ConflictResolution) {
    const updated = get().conflicts.map(c =>
      c.id === id ? { ...c, resolution } : c
    )
    writeToStorage(updated)
    set({ conflicts: updated })
  },

  getConflictsForSession(sessionId: string) {
    return get().conflicts.filter(c => c.sessionId === sessionId)
  },
}))

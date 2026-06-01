import { create } from 'zustand'
import type { GameSession, SupplementRecord } from '@/types'

interface SupplementState {
  supplements: Map<string, SupplementRecord[]>
  baselines: Map<string, GameSession>

  addSupplement: (sessionId: string, record: SupplementRecord) => void
  getSupplements: (sessionId: string) => SupplementRecord[]
  getBaselineSnapshot: (sessionId: string) => GameSession | undefined
  saveBaseline: (sessionId: string, session: GameSession) => void
}

export const useSupplementStore = create<SupplementState>((set, get) => ({
  supplements: new Map(),
  baselines: new Map(),

  addSupplement(sessionId: string, record: SupplementRecord) {
    const { supplements } = get()
    const updated = new Map(supplements)
    const existing = updated.get(sessionId) ?? []
    updated.set(sessionId, [...existing, record])
    set({ supplements: updated })
  },

  getSupplements(sessionId: string) {
    return get().supplements.get(sessionId) ?? []
  },

  getBaselineSnapshot(sessionId: string) {
    return get().baselines.get(sessionId)
  },

  saveBaseline(sessionId: string, session: GameSession) {
    const { baselines } = get()
    if (baselines.has(sessionId)) return
    const updated = new Map(baselines)
    updated.set(sessionId, { ...session })
    set({ baselines: updated })
  },
}))

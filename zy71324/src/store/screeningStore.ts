import { create } from 'zustand'
import { WeightConfig, RoomConfig, MaterialCombination, CombinationItem, ScoreBreakdown } from '@/types'

interface ScreeningStore {
  weightConfig: WeightConfig
  roomConfig: RoomConfig
  combinations: MaterialCombination[]
  selectedBreakdown: ScoreBreakdown | null

  setWeightConfig: (config: Partial<WeightConfig>) => void
  setRoomConfig: (config: Partial<RoomConfig>) => void
  addCombination: (combo: MaterialCombination) => void
  removeCombination: (id: string) => void
  updateCombination: (id: string, updates: Partial<MaterialCombination>) => void
  setSelectedBreakdown: (breakdown: ScoreBreakdown | null) => void
}

export const useScreeningStore = create<ScreeningStore>((set) => ({
  weightConfig: { lowWeight: 1, midWeight: 1, highWeight: 1 },
  roomConfig: { length: 6, width: 4, height: 3, budget: 50000 },
  combinations: [],
  selectedBreakdown: null,

  setWeightConfig: (config) =>
    set((s) => ({ weightConfig: { ...s.weightConfig, ...config } })),
  setRoomConfig: (config) =>
    set((s) => ({ roomConfig: { ...s.roomConfig, ...config } })),
  addCombination: (combo) => set((s) => ({ combinations: [...s.combinations, combo] })),
  removeCombination: (id) =>
    set((s) => ({ combinations: s.combinations.filter((c) => c.id !== id) })),
  updateCombination: (id, updates) =>
    set((s) => ({
      combinations: s.combinations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  setSelectedBreakdown: (breakdown) => set({ selectedBreakdown: breakdown }),
}))

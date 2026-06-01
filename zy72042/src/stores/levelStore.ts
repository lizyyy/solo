import { create } from 'zustand'

interface LevelState {
  currentLevelId: string | null
  completedLevels: string[]

  setCurrentLevel: (id: string) => void
  markLevelCompleted: (id: string) => void
}

export const useLevelStore = create<LevelState>((set, get) => ({
  currentLevelId: null,
  completedLevels: [],

  setCurrentLevel(id: string) {
    set({ currentLevelId: id })
  },

  markLevelCompleted(id: string) {
    const { completedLevels } = get()
    if (!completedLevels.includes(id)) {
      set({ completedLevels: [...completedLevels, id] })
    }
  },
}))

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { LevelPack } from "@/types"
import { levelPacks } from "@/data/levelPacks"

interface LevelState {
  levelPacks: LevelPack[]
  selectedLevelPackId: string
  setSelectedLevelPack: (id: string) => void
  getSelectedLevelPack: () => LevelPack | undefined
  getScenario: (levelPackId: string, scenarioId: string) => LevelPack["scenarios"][0] | undefined
}

export const useLevelStore = create<LevelState>()(
  persist(
    (set, get) => ({
      levelPacks,
      selectedLevelPackId: levelPacks[0]?.id ?? "",
      setSelectedLevelPack: (id) => set({ selectedLevelPackId: id }),
      getSelectedLevelPack: () => {
        const { levelPacks, selectedLevelPackId } = get()
        return levelPacks.find((p) => p.id === selectedLevelPackId)
      },
      getScenario: (levelPackId, scenarioId) => {
        const { levelPacks } = get()
        const pack = levelPacks.find((p) => p.id === levelPackId)
        return pack?.scenarios.find((s) => s.id === scenarioId)
      },
    }),
    {
      name: "ai-camp-level-store",
    }
  )
)

import { create } from 'zustand'
import type { AnomalyType } from '@/types'

interface FilterState {
  selectedZoneIds: string[]
  selectedAnomalyTypes: AnomalyType[]
  splRange: [number, number]
  panelOpen: boolean
}

interface FilterActions {
  toggleZone: (zoneId: string) => void
  setAnomalyTypes: (types: AnomalyType[]) => void
  setSplRange: (range: [number, number]) => void
  togglePanel: () => void
}

const useFilterStore = create<FilterState & FilterActions>()((set) => ({
  selectedZoneIds: [],
  selectedAnomalyTypes: [],
  splRange: [45, 105],
  panelOpen: true,

  toggleZone: (zoneId) =>
    set((state) => ({
      selectedZoneIds: state.selectedZoneIds.includes(zoneId)
        ? state.selectedZoneIds.filter((id) => id !== zoneId)
        : [...state.selectedZoneIds, zoneId],
    })),

  setAnomalyTypes: (types) => set({ selectedAnomalyTypes: types }),
  setSplRange: (range) => set({ splRange: range }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
}))

export default useFilterStore

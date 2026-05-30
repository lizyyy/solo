import { create } from "zustand"
import type { AggregatedExposure } from "../data/types"

interface SelectionState {
  selectedExposure: AggregatedExposure | null
  hoveredExposureId: string | null
  selectExposure: (exposure: AggregatedExposure | null) => void
  setHovered: (id: string | null) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedExposure: null,
  hoveredExposureId: null,
  selectExposure: (exposure) => set({ selectedExposure: exposure }),
  setHovered: (id) => set({ hoveredExposureId: id }),
}))

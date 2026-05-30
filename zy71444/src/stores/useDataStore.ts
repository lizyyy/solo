import { create } from "zustand"
import type { OptionPosition, AggregatedExposure } from "../data/types"
import { MOCK_POSITIONS } from "../data/mockData"
import { aggregatePositions } from "../utils/aggregator"

interface DataState {
  positions: OptionPosition[]
  aggregated: AggregatedExposure[]
  refreshAggregated: () => void
}

export const useDataStore = create<DataState>((set, get) => ({
  positions: MOCK_POSITIONS,
  aggregated: aggregatePositions(MOCK_POSITIONS),
  refreshAggregated: () => {
    set({ aggregated: aggregatePositions(get().positions) })
  },
}))

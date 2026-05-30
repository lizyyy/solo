import { create } from "zustand"
import type { GreekKey } from "../data/types"
import { EXPIRY_BUCKETS } from "../data/mockData"

interface FilterState {
  activeGreeks: GreekKey[]
  activeBuckets: string[]
  thresholdValue: number
  toggleGreek: (greek: GreekKey) => void
  toggleBucket: (bucketId: string) => void
  setThreshold: (value: number) => void
  setActiveBuckets: (buckets: string[]) => void
  setActiveGreeks: (greeks: GreekKey[]) => void
}

export const useFilterStore = create<FilterState>((set) => ({
  activeGreeks: ["delta", "gamma", "vega"],
  activeBuckets: EXPIRY_BUCKETS.map((b) => b.id),
  thresholdValue: 0,
  toggleGreek: (greek) =>
    set((state) => {
      const next = state.activeGreeks.includes(greek)
        ? state.activeGreeks.filter((g) => g !== greek)
        : [...state.activeGreeks, greek]
      return next.length > 0 ? { activeGreeks: next } : state
    }),
  toggleBucket: (bucketId) =>
    set((state) => ({
      activeBuckets: state.activeBuckets.includes(bucketId)
        ? state.activeBuckets.filter((b) => b !== bucketId)
        : [...state.activeBuckets, bucketId],
    })),
  setThreshold: (value) => set({ thresholdValue: value }),
  setActiveBuckets: (buckets) => set({ activeBuckets: buckets }),
  setActiveGreeks: (greeks) => set({ activeGreeks: greeks }),
}))

import { create } from "zustand"
import type { ComputationTrace, ExperimentRecord } from "@/types"
import { computeHeatConduction } from "@/utils/heatConduction"
import { useThresholdStore } from "./useThresholdStore"

interface ComputationStore {
  traces: ComputationTrace[]
  isComputing: boolean
  computeForRecord: (record: ExperimentRecord) => ComputationTrace | null
  computeForBatch: (records: ExperimentRecord[]) => void
  getTracesForRecord: (recordId: string) => ComputationTrace[]
  getLatestTraceForRecord: (recordId: string) => ComputationTrace | null
  clearTraces: () => void
}

export const useComputationStore = create<ComputationStore>((set, get) => ({
  traces: [],
  isComputing: false,

  computeForRecord: (record) => {
    const threshold = useThresholdStore.getState().getCurrentThreshold()
    const trace = computeHeatConduction(
      record,
      1,
      threshold.version,
      threshold.maxValue,
    )
    if (trace) {
      set((state) => ({ traces: [...state.traces, trace] }))
    }
    return trace
  },

  computeForBatch: (records) => {
    set({ isComputing: true })
    const threshold = useThresholdStore.getState().getCurrentThreshold()
    const newTraces: ComputationTrace[] = []

    for (const record of records) {
      const trace = computeHeatConduction(
        record,
        1,
        threshold.version,
        threshold.maxValue,
      )
      if (trace) newTraces.push(trace)
    }

    set((state) => ({
      traces: [...state.traces, ...newTraces],
      isComputing: false,
    }))
  },

  getTracesForRecord: (recordId) => {
    return get().traces.filter((t) => t.recordId === recordId)
  },

  getLatestTraceForRecord: (recordId) => {
    const traces = get().traces.filter((t) => t.recordId === recordId)
    return traces.length > 0 ? traces[traces.length - 1] : null
  },

  clearTraces: () => set({ traces: [] }),
}))

import { create } from 'zustand'
import type { TensileCurve, ClusterResult, ConflictRecord, FilterState, AlignmentParams } from '@/types'

interface AnalysisState {
  curves: TensileCurve[]
  filteredCurves: TensileCurve[]
  clusterResult: ClusterResult | null
  conflicts: ConflictRecord[]
  filterState: FilterState
  alignmentParams: AlignmentParams
  selectedCurveId: string | null
  selectedClusterId: number | null
  isAnalyzing: boolean

  setCurves: (curves: TensileCurve[]) => void
  setFilteredCurves: (curves: TensileCurve[]) => void
  setClusterResult: (result: ClusterResult | null) => void
  setConflicts: (conflicts: ConflictRecord[]) => void
  setFilterState: (filter: FilterState) => void
  setAlignmentParams: (params: AlignmentParams) => void
  setSelectedCurveId: (id: string | null) => void
  setSelectedClusterId: (id: number | null) => void
  setIsAnalyzing: (v: boolean) => void
  applyFilter: () => void
  reset: () => void
}

const defaultFilter: FilterState = {
  selectedBatches: [],
  selectedDevices: [],
  selectedAnomalyTypes: [],
  selectedFractureTypes: [],
}

const defaultAlignment: AlignmentParams = {
  mode: 'interpolation',
  targetLength: 100,
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  curves: [],
  filteredCurves: [],
  clusterResult: null,
  conflicts: [],
  filterState: defaultFilter,
  alignmentParams: defaultAlignment,
  selectedCurveId: null,
  selectedClusterId: null,
  isAnalyzing: false,

  setCurves: (curves) => set({ curves }),
  setFilteredCurves: (filteredCurves) => set({ filteredCurves }),
  setClusterResult: (clusterResult) => set({ clusterResult }),
  setConflicts: (conflicts) => set({ conflicts }),
  setFilterState: (filterState) => set({ filterState }),
  setAlignmentParams: (alignmentParams) => set({ alignmentParams }),
  setSelectedCurveId: (selectedCurveId) => set({ selectedCurveId }),
  setSelectedClusterId: (selectedClusterId) => set({ selectedClusterId }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  applyFilter: () => {
    const { curves, filterState } = get()
    const { selectedBatches, selectedDevices, selectedAnomalyTypes, selectedFractureTypes } = filterState

    const batchSet = new Set(selectedBatches)
    const deviceSet = new Set(selectedDevices)
    const anomalySet = new Set(selectedAnomalyTypes)
    const fractureSet = new Set(selectedFractureTypes)

    const filtered = curves.filter((c) => {
      if (batchSet.size > 0 && !batchSet.has(c.batchNo)) return false
      if (deviceSet.size > 0 && !deviceSet.has(c.deviceId)) return false
      if (anomalySet.size > 0 && !anomalySet.has(c.isAnomaly ? '异常' : '正常')) return false
      if (fractureSet.size > 0 && (!c.fractureType || !fractureSet.has(c.fractureType))) return false
      return true
    })

    set({ filteredCurves: filtered })
  },

  reset: () =>
    set({
      curves: [],
      filteredCurves: [],
      clusterResult: null,
      conflicts: [],
      filterState: defaultFilter,
      alignmentParams: defaultAlignment,
      selectedCurveId: null,
      selectedClusterId: null,
      isAnalyzing: false,
    }),
}))

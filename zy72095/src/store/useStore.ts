import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  IntersectionData,
  SpeedBandResult,
  ValidationResult,
  OptimizationSuggestion,
  ManualAdjustment,
  ConflictChoice,
} from '@/lib/types'

interface StoreState {
  rawText: string
  intersections: IntersectionData[]
  validationResults: ValidationResult[]
  speedBandResults: SpeedBandResult[]
  optimizationSuggestions: OptimizationSuggestion[]
  manualAdjustments: ManualAdjustment[]
  conflictChoices: ConflictChoice[]
  commonCycle: number
  direction: '上行' | '下行'
  activeFilter: '上行' | '下行' | '全部'
  anomaliesIncluded: boolean
  annotations: Record<string, string>
}

interface StoreActions {
  setRawText: (text: string) => void
  setIntersections: (data: IntersectionData[]) => void
  setIntersectionsAndMerge: (data: IntersectionData[]) => void
  setValidationResults: (results: ValidationResult[]) => void
  setSpeedBandResults: (results: SpeedBandResult[]) => void
  setOptimizationSuggestions: (suggestions: OptimizationSuggestion[]) => void
  addManualAdjustment: (adj: ManualAdjustment) => void
  setConflictChoices: (choices: ConflictChoice[]) => void
  addConflictChoice: (choice: ConflictChoice) => void
  setCommonCycle: (cycle: number) => void
  setDirection: (dir: '上行' | '下行') => void
  setActiveFilter: (filter: '全部' | '上行' | '下行') => void
  setAnomaliesIncluded: (included: boolean) => void
  setAnnotation: (id: string, annotation: string) => void
  resetCalculation: () => void
  getFilteredIntersections: () => IntersectionData[]
}

export const useStore = create<StoreState & StoreActions>()(
  persist(
    (set, get) => ({
      rawText: '',
      intersections: [],
      validationResults: [],
      speedBandResults: [],
      optimizationSuggestions: [],
      manualAdjustments: [],
      conflictChoices: [],
      commonCycle: 120,
      direction: '上行',
      activeFilter: '全部',
      anomaliesIncluded: true,
      annotations: {},

      setRawText: (text) => set({ rawText: text }),
      setIntersections: (data) => set({ intersections: data }),
      setIntersectionsAndMerge: (data) => {
        const { manualAdjustments } = get()
        const merged = data.map((item) => {
          const matching = manualAdjustments.filter(
            (adj) => adj.intersectionId === item.id
          )
          if (matching.length === 0) return item
          const updated = { ...item }
          for (const adj of matching) {
            if (adj.field in updated) {
              (updated as Record<string, unknown>)[adj.field] = adj.adjustedValue
            }
          }
          return updated
        })
        set({ intersections: merged })
      },
      setValidationResults: (results) => set({ validationResults: results }),
      setSpeedBandResults: (results) => set({ speedBandResults: results }),
      setOptimizationSuggestions: (suggestions) => set({ optimizationSuggestions: suggestions }),
      addManualAdjustment: (adj) =>
        set((state) => {
          const idx = state.manualAdjustments.findIndex(
            (item) => item.intersectionId === adj.intersectionId && item.field === adj.field
          )
          if (idx >= 0) {
            const updated = [...state.manualAdjustments]
            updated[idx] = adj
            return { manualAdjustments: updated }
          }
          return { manualAdjustments: [...state.manualAdjustments, adj] }
        }),
      setConflictChoices: (choices) => set({ conflictChoices: choices }),
      addConflictChoice: (choice) =>
        set((state) => ({ conflictChoices: [...state.conflictChoices, choice] })),
      setCommonCycle: (cycle) => set({ commonCycle: cycle }),
      setDirection: (dir) => set({ direction: dir }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      setAnomaliesIncluded: (included) => set({ anomaliesIncluded: included }),
      setAnnotation: (id, annotation) =>
        set((state) => {
          const updated = { ...state.annotations }
          if (annotation === '') {
            delete updated[id]
          } else {
            updated[id] = annotation
          }
          return { annotations: updated }
        }),
      resetCalculation: () =>
        set((state) => ({
          rawText: '',
          intersections: [],
          validationResults: [],
          speedBandResults: [],
          optimizationSuggestions: [],
          conflictChoices: [],
          commonCycle: 120,
          manualAdjustments: state.manualAdjustments,
          annotations: state.annotations,
        })),
      getFilteredIntersections: () => {
        const { intersections, activeFilter } = get()
        if (activeFilter === '全部') return intersections
        return intersections.filter((i) => i.direction === activeFilter)
      },
    }),
    {
      name: 'green-wave-store',
    }
  )
)

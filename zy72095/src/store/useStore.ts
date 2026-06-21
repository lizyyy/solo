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
import { calculateSpeedBand, calculateOptimizations } from '@/lib/calculator'

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
  recalculate: () => void
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
        const speedBandResults = calculateSpeedBand(merged)
        const optimizationSuggestions = calculateOptimizations(merged, speedBandResults)
        set({ intersections: merged, speedBandResults, optimizationSuggestions })
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
      recalculate: () => {
        const { intersections } = get()
        const speedBandResults = calculateSpeedBand(intersections)
        const optimizationSuggestions = calculateOptimizations(intersections, speedBandResults)
        set({ speedBandResults, optimizationSuggestions })
      },
    }),
    {
      name: 'green-wave-store',
    }
  )
)

if (typeof window !== 'undefined') {
  // @ts-ignore - for E2E testing only
  window.__gwStore = useStore
  // @ts-ignore
  window.__gwValidate = () => {
    const state = useStore.getState()
    const { intersections, speedBandResults, manualAdjustments } = state

    function calcExpected() {
      const bandwidth = Math.min(...intersections.map(d => d.cycle * d.greenRatio))
      const expected = []
      for (let i = 0; i < intersections.length - 1; i++) {
        const from = intersections[i];
        const to = intersections[i + 1]
        const distance = to.distanceFromStart - from.distanceFromStart
        const deltaOffset = to.offset - from.offset
        const greenTimeFrom = from.cycle * from.greenRatio
        const greenTimeTo = to.cycle * to.greenRatio
        const segmentBandwidth = Math.min(greenTimeFrom, greenTimeTo)
        let isAnomalous = false
        let reason = ''
        if (segmentBandwidth <= 0) { isAnomalous = true; reason = '绿信比为0导致无绿波带宽' }
        else if (deltaOffset <= 0) { isAnomalous = true; reason = '偏移差≤0，无法形成绿波' }
        else {
          const halfBand = bandwidth / 2
          const denominatorMax = deltaOffset - halfBand
          if (denominatorMax <= 0) { isAnomalous = true; reason = '偏移差不足以支撑绿波带宽' }
        }
        expected.push({
          segmentIndex: i, isAnomalous, reason, bandwidth: Math.round(segmentBandwidth * 10) / 10,
        })
      }
      return expected
    }

    const expected = calcExpected()
    const results = []
    results.push({ name: 'J03 offset 保留修正值', expect: 40, actual: intersections.find(i => i.id === 'J03')?.offset })
    results.push({ name: 'J04 greenRatio 保留修正值', expect: 0.55, actual: intersections.find(i => i.id === 'J04')?.greenRatio })
    results.push({ name: '人工修正记录数=2', expect: 2, actual: manualAdjustments.length })
    results.push({ name: '速度带段数=4', expect: 4, actual: speedBandResults.length })
    let allMatch = true
    for (let i = 0; i < expected.length; i++) {
      const actual = speedBandResults[i]
      const exp = expected[i]
      const match = actual?.isAnomalous === exp.isAnomalous && actual?.bandwidth === exp.bandwidth
      if (!match) allMatch = false
    }
    results.push({ name: 'speedBandResults = 按修正值重算结果', expect: true, actual: allMatch })
    results.push({ name: '异常段数一致', expect: expected.filter(r => r.isAnomalous).length, actual: speedBandResults.filter(r => r.isAnomalous).length })
    results.push({ name: '有效段数一致', expect: expected.filter(r => !r.isAnomalous).length, actual: speedBandResults.filter(r => !r.isAnomalous).length })

    const j03Adj = manualAdjustments.find(a => a.intersectionId === 'J03' && a.field === 'offset')
    const j04Adj = manualAdjustments.find(a => a.intersectionId === 'J04' && a.field === 'greenRatio')
    results.push({ name: 'J03 修正记录原始值=48', expect: 48, actual: j03Adj?.originalValue })
    results.push({ name: 'J04 修正记录原始值=0.52', expect: 0.52, actual: j04Adj?.originalValue })

    const pass = results.filter(r => r.expect === r.actual).length
    const total = results.length
    return { pass, total, results }
  }
}

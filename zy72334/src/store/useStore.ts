import { create } from 'zustand'
import type { RawData, BoundaryRecord, WeightEntry, SVDResult, WorkflowStep, AnomalyPoint } from '@/types'
import { scanBoundaryValues } from '@/utils/scanner'
import { computeSVD } from '@/utils/svd'

function buildAnomalyPoints(
  boundaryRecords: BoundaryRecord[],
  svdResult: SVDResult | null,
  weights: WeightEntry[]
): AnomalyPoint[] {
  return boundaryRecords
    .filter(r => r.status !== 'resolved')
    .map(r => ({
      recordId: r.id,
      pointIndex: r.rowIndex,
      projectedCoords: [
        svdResult?.projectedData[r.rowIndex]?.[0] ?? 0,
        svdResult?.projectedData[r.rowIndex]?.[1] ?? 0,
        svdResult?.projectedData[r.rowIndex]?.[2] ?? 0,
      ] as [number, number, number],
      linkedBoundaryId: r.id,
      linkedWeightId: weights.find(w => w.columnName === r.columnName)?.id ?? null,
    }))
}

interface AppState {
  rawData: RawData | null
  boundaryRecords: BoundaryRecord[]
  weights: WeightEntry[]
  svdResult: SVDResult | null
  anomalyPoints: AnomalyPoint[]
  workflowSteps: WorkflowStep[]
  selectedAnomalyId: string | null
  tracePanelOpen: boolean

  importData: (rawData: RawData) => void
  updateBoundaryStatus: (id: string, status: BoundaryRecord['status']) => void
  setWeight: (columnName: string, weight: number) => void
  markWeightComplete: (id: string) => void
  recomputeSVD: () => void
  selectAnomaly: (id: string | null) => void
  toggleTracePanel: () => void
  reset: () => void
}

function buildWorkflowSteps(
  rawData: RawData | null,
  weights: WeightEntry[],
  svdResult: SVDResult | null
): WorkflowStep[] {
  const allWeightsComplete = weights.length > 0 && weights.every(w => w.isComplete)
  return [
    { step: 1, label: '数据导入', route: '/', isComplete: rawData !== null },
    { step: 2, label: '评分权重表', route: '/weights', isComplete: allWeightsComplete },
    { step: 3, label: '降维报告', route: '/report', isComplete: svdResult !== null },
  ]
}

export const useStore = create<AppState>((set, get) => ({
  rawData: null,
  boundaryRecords: [],
  weights: [],
  svdResult: null,
  anomalyPoints: [],
  workflowSteps: buildWorkflowSteps(null, [], null),
  selectedAnomalyId: null,
  tracePanelOpen: false,

  importData: (rawData: RawData) => {
    const boundaryRecords = scanBoundaryValues(rawData.headers, rawData.rows, rawData.numericMatrix)
    const weights: WeightEntry[] = rawData.headers.map((h, i) => ({
      id: `w-${i}`, columnName: h, weight: 1, isComplete: false,
    }))
    const svdResult = computeSVD(rawData.numericMatrix, weights, boundaryRecords)
    const anomalyPoints = buildAnomalyPoints(boundaryRecords, svdResult, weights)
    set({ rawData, boundaryRecords, weights, svdResult, anomalyPoints, workflowSteps: buildWorkflowSteps(rawData, weights, svdResult) })
  },

  updateBoundaryStatus: (id, status) => {
    set(state => {
      const boundaryRecords = state.boundaryRecords.map(r => r.id === id ? { ...r, status } : r)
      const svdResult = computeSVD(state.rawData!.numericMatrix, state.weights, boundaryRecords)
      const anomalyPoints = buildAnomalyPoints(boundaryRecords, svdResult, state.weights)
      return { boundaryRecords, svdResult, anomalyPoints, workflowSteps: buildWorkflowSteps(state.rawData, state.weights, svdResult) }
    })
  },

  setWeight: (columnName, weight) => {
    set(state => {
      const weights = state.weights.map(w => w.columnName === columnName ? { ...w, weight } : w)
      const svdResult = computeSVD(state.rawData!.numericMatrix, weights, state.boundaryRecords)
      const anomalyPoints = buildAnomalyPoints(state.boundaryRecords, svdResult, weights)
      return { weights, svdResult, anomalyPoints, workflowSteps: buildWorkflowSteps(state.rawData, weights, svdResult) }
    })
  },

  markWeightComplete: (id) => {
    set(state => {
      const weights = state.weights.map(w => w.id === id ? { ...w, isComplete: true } : w)
      const svdResult = computeSVD(state.rawData!.numericMatrix, weights, state.boundaryRecords)
      const anomalyPoints = buildAnomalyPoints(state.boundaryRecords, svdResult, weights)
      return { weights, svdResult, anomalyPoints, workflowSteps: buildWorkflowSteps(state.rawData, weights, svdResult) }
    })
  },

  recomputeSVD: () => {
    const { rawData, weights, boundaryRecords } = get()
    if (!rawData) return
    const svdResult = computeSVD(rawData.numericMatrix, weights, boundaryRecords)
    const anomalyPoints = buildAnomalyPoints(boundaryRecords, svdResult, weights)
    set({ svdResult, anomalyPoints, workflowSteps: buildWorkflowSteps(rawData, weights, svdResult) })
  },

  selectAnomaly: (id) => set({ selectedAnomalyId: id, tracePanelOpen: id !== null }),
  toggleTracePanel: () => set(state => ({ tracePanelOpen: !state.tracePanelOpen })),
  reset: () => set({
    rawData: null, boundaryRecords: [], weights: [], svdResult: null, anomalyPoints: [],
    workflowSteps: buildWorkflowSteps(null, [], null), selectedAnomalyId: null, tracePanelOpen: false,
  }),
}))

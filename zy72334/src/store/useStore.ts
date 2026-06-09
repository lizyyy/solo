import { create } from 'zustand'
import type { RawData, BoundaryRecord, WeightEntry, SVDResult, WorkflowStep, AnomalyPoint, Role } from '@/types'
import { scanBoundaryValues, reviewRecord, resolveRecord } from '@/utils/scanner'
import { computeSVD } from '@/utils/svd'
import { detectColumnTypes, toNumericMatrix } from '@/utils/csvParser'

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

function buildNumericMatrixWithCorrections(
  rawData: RawData,
  boundaryRecords: BoundaryRecord[]
): number[][] {
  const base = rawData.numericMatrix.map(row => [...row])
  for (const r of boundaryRecords) {
    if (r.status === 'resolved' && r.correctedValue !== '') {
      const n = Number(r.correctedValue)
      if (!isNaN(n) && isFinite(n)) {
        base[r.rowIndex] = base[r.rowIndex] ?? []
        base[r.rowIndex][r.columnIndex] = n
      }
    }
  }
  return base
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

  importParsed: (fileName: string, headers: string[], rows: string[][]) => void
  reviewBoundary: (id: string, role: Role, note?: string) => void
  resolveBoundary: (id: string, role: Role, correctedValue: string, resolvedReason: string) => void
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

  importParsed: (fileName, headers, rows) => {
    const columnTypes = detectColumnTypes(headers, rows)
    const numericMatrix = toNumericMatrix(rows, headers.length)
    const rawData: RawData = {
      id: `raw-${Date.now()}`,
      fileName,
      headers,
      columnTypes,
      rows,
      numericMatrix,
      uploadTime: new Date().toLocaleString('zh-CN'),
    }
    const boundaryRecords = scanBoundaryValues(headers, columnTypes, rows, numericMatrix)
    const weights: WeightEntry[] = headers
      .map((h, i) => ({
        id: `w-${i}`,
        columnName: h,
        columnIndex: i,
        weight: 1,
        isComplete: false,
      }))
    const svdResult = computeSVD(numericMatrix, weights, boundaryRecords)
    const anomalyPoints = buildAnomalyPoints(boundaryRecords, svdResult, weights)
    set({
      rawData,
      boundaryRecords,
      weights,
      svdResult,
      anomalyPoints,
      workflowSteps: buildWorkflowSteps(rawData, weights, svdResult),
    })
  },

  reviewBoundary: (id, role, note) => {
    set(state => {
      const target = state.boundaryRecords.find(r => r.id === id)
      if (!target) return {}
      const updated = reviewRecord(target, role, note)
      const boundaryRecords = state.boundaryRecords.map(r => (r.id === id ? updated : r))
      const correctedMatrix = buildNumericMatrixWithCorrections(state.rawData!, boundaryRecords)
      const svdResult = computeSVD(correctedMatrix, state.weights, boundaryRecords)
      const anomalyPoints = buildAnomalyPoints(boundaryRecords, svdResult, state.weights)
      return {
        boundaryRecords,
        svdResult,
        anomalyPoints,
        workflowSteps: buildWorkflowSteps(state.rawData, state.weights, svdResult),
      }
    })
  },

  resolveBoundary: (id, role, correctedValue, resolvedReason) => {
    set(state => {
      const target = state.boundaryRecords.find(r => r.id === id)
      if (!target) return {}
      const updated = resolveRecord(target, role, correctedValue, resolvedReason)
      const boundaryRecords = state.boundaryRecords.map(r => (r.id === id ? updated : r))
      const correctedMatrix = buildNumericMatrixWithCorrections(state.rawData!, boundaryRecords)
      const svdResult = computeSVD(correctedMatrix, state.weights, boundaryRecords)
      const anomalyPoints = buildAnomalyPoints(boundaryRecords, svdResult, state.weights)
      return {
        boundaryRecords,
        svdResult,
        anomalyPoints,
        workflowSteps: buildWorkflowSteps(state.rawData, state.weights, svdResult),
      }
    })
  },

  setWeight: (columnName, weight) => {
    set(state => {
      const weights = state.weights.map(w => w.columnName === columnName ? { ...w, weight } : w)
      const correctedMatrix = buildNumericMatrixWithCorrections(state.rawData!, state.boundaryRecords)
      const svdResult = computeSVD(correctedMatrix, weights, state.boundaryRecords)
      const anomalyPoints = buildAnomalyPoints(state.boundaryRecords, svdResult, weights)
      return {
        weights,
        svdResult,
        anomalyPoints,
        workflowSteps: buildWorkflowSteps(state.rawData, weights, svdResult),
      }
    })
  },

  markWeightComplete: (id) => {
    set(state => {
      const weights = state.weights.map(w => w.id === id ? { ...w, isComplete: true } : w)
      const correctedMatrix = buildNumericMatrixWithCorrections(state.rawData!, state.boundaryRecords)
      const svdResult = computeSVD(correctedMatrix, weights, state.boundaryRecords)
      const anomalyPoints = buildAnomalyPoints(state.boundaryRecords, svdResult, weights)
      return {
        weights,
        svdResult,
        anomalyPoints,
        workflowSteps: buildWorkflowSteps(state.rawData, weights, svdResult),
      }
    })
  },

  recomputeSVD: () => {
    const { rawData, weights, boundaryRecords } = get()
    if (!rawData) return
    const correctedMatrix = buildNumericMatrixWithCorrections(rawData, boundaryRecords)
    const svdResult = computeSVD(correctedMatrix, weights, boundaryRecords)
    const anomalyPoints = buildAnomalyPoints(boundaryRecords, svdResult, weights)
    set({
      svdResult,
      anomalyPoints,
      workflowSteps: buildWorkflowSteps(rawData, weights, svdResult),
    })
  },

  selectAnomaly: (id) => set({ selectedAnomalyId: id, tracePanelOpen: id !== null }),
  toggleTracePanel: () => set(state => ({ tracePanelOpen: !state.tracePanelOpen })),
  reset: () => set({
    rawData: null, boundaryRecords: [], weights: [], svdResult: null, anomalyPoints: [],
    workflowSteps: buildWorkflowSteps(null, [], null), selectedAnomalyId: null, tracePanelOpen: false,
  }),
}))

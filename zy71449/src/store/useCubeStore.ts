import { create } from 'zustand'
import type {
  CubeParameters,
  AnomalyRecord,
  DecisionLog,
  LossCubeSnapshot,
  ExportResult,
  TyphoonEvent,
  TyphoonPathPoint,
  Region,
  Policy,
  Claim,
} from '@/types'
import { typhoonEvents, typhoonPathPoints, regions, policies, claims } from '@/data/mockData'
import { runAnomalyDetection } from '@/engine/anomalyEngine'
import { saveSnapshot, loadAllSnapshots, loadSnapshotById, updateAnomaly } from '@/db/indexedDB'

interface LossCubeState {
  parameters: CubeParameters
  activeSnapshotId: string | null
  selectedRegionId: string | null
  timeSlicePosition: number | null
  anomalies: AnomalyRecord[]
  decisions: DecisionLog[]
  snapshots: LossCubeSnapshot[]
  showExportPanel: boolean
  showDrillDown: boolean

  typhoonEvents: TyphoonEvent[]
  typhoonPathPoints: TyphoonPathPoint[]
  regions: Region[]
  policies: Policy[]
  claims: Claim[]

  setParameters: (params: Partial<CubeParameters>) => void
  setTimeSlice: (position: number | null) => void
  selectRegion: (regionId: string | null) => void
  acknowledgeAnomaly: (id: string) => void
  addDecision: (action: string, reason: string) => void
  saveCurrentSnapshot: (name: string) => Promise<string>
  loadSnapshots: () => Promise<void>
  loadSnapshotData: (id: string) => Promise<void>
  exportReport: () => ExportResult
  setShowExportPanel: (show: boolean) => void
  setShowDrillDown: (show: boolean) => void
  deleteSnapshot: (id: string) => Promise<void>
  recomputeAnomalies: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const defaultTyphoon = typhoonEvents[0]
const defaultTimeStart = new Date(defaultTyphoon.startDate).getTime()
const defaultTimeEnd = new Date(defaultTyphoon.endDate).getTime()

const initialParameters: CubeParameters = {
  typhoonId: defaultTyphoon.id,
  timeRange: [defaultTimeStart, defaultTimeEnd],
  regionIds: regions.map(r => r.id),
  claimThreshold: 0,
  showTyphoonPath: true,
  showPolicyDistribution: true,
  showClaims: true,
}

function getFilteredData(state: LossCubeState) {
  const filteredPaths = state.typhoonPathPoints.filter(
    p => p.typhoonId === state.parameters.typhoonId
  )
  const filteredPolicies = state.policies.filter(
    p =>
      p.typhoonId === state.parameters.typhoonId &&
      state.parameters.regionIds.includes(p.regionId)
  )
  const filteredClaims = state.claims.filter(
    c =>
      c.typhoonId === state.parameters.typhoonId &&
      state.parameters.regionIds.includes(c.regionId) &&
      c.claimAmount >= state.parameters.claimThreshold
  )
  return { filteredPaths, filteredPolicies, filteredClaims }
}

export const useCubeStore = create<LossCubeState>((set, get) => ({
  parameters: initialParameters,
  activeSnapshotId: null,
  selectedRegionId: null,
  timeSlicePosition: null,
  anomalies: [],
  decisions: [],
  snapshots: [],
  showExportPanel: false,
  showDrillDown: false,

  typhoonEvents,
  typhoonPathPoints,
  regions,
  policies,
  claims,

  setParameters: (params) => {
    set(state => {
      const newParams = { ...state.parameters, ...params }
      return { parameters: newParams }
    })
    get().recomputeAnomalies()
  },

  setTimeSlice: (position) => set({ timeSlicePosition: position }),

  selectRegion: (regionId) => set({ selectedRegionId: regionId, showDrillDown: regionId !== null }),

  acknowledgeAnomaly: async (id) => {
    const anomaly = get().anomalies.find(a => a.id === id)
    if (anomaly) {
      const updated = { ...anomaly, acknowledged: true }
      set(state => ({
        anomalies: state.anomalies.map(a => (a.id === id ? updated : a)),
      }))
      if (get().activeSnapshotId) {
        await updateAnomaly(updated)
      }
    }
  },

  addDecision: (action, reason) => {
    const decision: DecisionLog = {
      id: generateId(),
      cubeSnapshotId: get().activeSnapshotId || '',
      action,
      reason,
      operator: '精算分析师',
      timestamp: new Date().toISOString(),
    }
    set(state => ({ decisions: [...state.decisions, decision] }))
  },

  saveCurrentSnapshot: async (name) => {
    const state = get()
    const { filteredPaths, filteredClaims } = getFilteredData(state)
    const typhoon = state.typhoonEvents.find(e => e.id === state.parameters.typhoonId)!

    const snapshotId = generateId()
    const anomaliesWithSnapshot = state.anomalies.map(a => ({
      ...a,
      cubeSnapshotId: snapshotId,
    }))
    const decisionsWithSnapshot = state.decisions.map(d => ({
      ...d,
      cubeSnapshotId: snapshotId,
    }))

    const snapshot: LossCubeSnapshot = {
      id: snapshotId,
      name,
      typhoonId: state.parameters.typhoonId,
      parameters: { ...state.parameters },
      anomalies: anomaliesWithSnapshot,
      decisions: decisionsWithSnapshot,
      createdAt: new Date().toISOString(),
      exportData: null,
    }

    await saveSnapshot(snapshot)
    set(state => ({
      snapshots: [...state.snapshots, snapshot],
      activeSnapshotId: snapshotId,
      anomalies: anomaliesWithSnapshot,
      decisions: decisionsWithSnapshot,
    }))

    return snapshotId
  },

  loadSnapshots: async () => {
    const snapshots = await loadAllSnapshots()
    set({ snapshots })
  },

  loadSnapshotData: async (id) => {
    const snapshot = await loadSnapshotById(id)
    if (snapshot) {
      set({
        parameters: snapshot.parameters,
        activeSnapshotId: snapshot.id,
        anomalies: snapshot.anomalies,
        decisions: snapshot.decisions,
        selectedRegionId: null,
        timeSlicePosition: null,
      })
    }
  },

  exportReport: () => {
    const state = get()
    const { filteredPolicies, filteredClaims } = getFilteredData(state)

    const totalInsuredAmount = filteredPolicies.reduce((s, p) => s + p.insuredAmount, 0)
    const totalClaimAmount = filteredClaims.reduce((s, c) => s + c.claimAmount, 0)

    const regionBreakdown = state.parameters.regionIds.map(rId => {
      const region = state.regions.find(r => r.id === rId)!
      const rPolicies = filteredPolicies.filter(p => p.regionId === rId)
      const rClaims = filteredClaims.filter(c => c.regionId === rId)
      return {
        regionId: rId,
        regionName: region.name,
        insuredAmount: rPolicies.reduce((s, p) => s + p.insuredAmount, 0),
        claimCount: rClaims.length,
        claimAmount: rClaims.reduce((s, c) => s + c.claimAmount, 0),
      }
    })

    const result: ExportResult = {
      timestamp: new Date().toISOString(),
      parameters: { ...state.parameters },
      summary: {
        totalInsuredAmount,
        totalClaims: filteredClaims.length,
        totalClaimAmount,
        regionCount: state.parameters.regionIds.length,
        anomalyCount: state.anomalies.filter(a => !a.acknowledged).length,
      },
      anomalies: [...state.anomalies],
      decisions: [...state.decisions],
      regionBreakdown,
    }

    return result
  },

  setShowExportPanel: (show) => set({ showExportPanel: show }),

  setShowDrillDown: (show) => {
    if (!show) set({ selectedRegionId: null })
    set({ showDrillDown: show })
  },

  deleteSnapshot: async (id) => {
    const { deleteSnapshot: delFn } = await import('@/db/indexedDB')
    await delFn(id)
    set(state => ({
      snapshots: state.snapshots.filter(s => s.id !== id),
      activeSnapshotId: state.activeSnapshotId === id ? null : state.activeSnapshotId,
    }))
  },

  recomputeAnomalies: () => {
    const state = get()
    const typhoon = state.typhoonEvents.find(e => e.id === state.parameters.typhoonId)
    if (!typhoon) return

    const { filteredPaths, filteredClaims } = getFilteredData(state)
    const anomalies = runAnomalyDetection(filteredPaths, typhoon, filteredClaims)
    set({ anomalies })
  },
}))

import { create } from 'zustand'
import { ParamSet, AnomalyItem, CompareScore, RackConfig, CRACUnit, AirflowSample, VersionRecord } from '@/types'
import { generateDefaultParamSet, computeAirflowSamples, detectAnomalies, computeScore } from '@/lib/mockEngine'

interface SaveParamSetOptions {
  name: string
  notes?: string
  receipt?: string
}

interface DCStore {
  paramSet: ParamSet
  anomalies: AnomalyItem[]
  airflowSamples: AirflowSample[]
  score: CompareScore
  savedParamSets: ParamSet[]
  compareLeftId: string | null
  compareRightId: string | null
  selectedAnomalyId: string | null
  paramPanelOpen: boolean
  anomalyPanelOpen: boolean
  sectionPlaneY: number
  showAirflow: boolean
  showHeatmap: boolean
  hoveredRackId: string | null

  updateParamSet: (partial: Partial<ParamSet>) => void
  updateRack: (id: string, partial: Partial<RackConfig>) => void
  updateCRAC: (id: string, partial: Partial<CRACUnit>) => void
  saveParamSet: (options: SaveParamSetOptions) => void
  loadParamSet: (id: string) => void
  deleteParamSet: (id: string) => void
  updateSavedParamSetMeta: (id: string, meta: { name?: string; notes?: string; receipt?: string }) => void
  setSelectedAnomalyId: (id: string | null) => void
  setParamPanelOpen: (open: boolean) => void
  setAnomalyPanelOpen: (open: boolean) => void
  setSectionPlaneY: (y: number) => void
  setShowAirflow: (show: boolean) => void
  setShowHeatmap: (show: boolean) => void
  setHoveredRackId: (id: string | null) => void
  setCompareIds: (left: string | null, right: string | null) => void
  recalculate: () => void
}

const defaultParamSet = generateDefaultParamSet()

const computeDerived = (ps: ParamSet) => {
  const airflowSamples = computeAirflowSamples(ps)
  const anomalies = detectAnomalies(ps, airflowSamples)
  const score = computeScore(ps, anomalies)
  return { airflowSamples, anomalies, score }
}

const migrateParamSet = (ps: Record<string, unknown>): ParamSet => {
  return {
    ...ps,
    version: (ps.version as number) ?? 1,
    notes: (ps.notes as string) ?? '',
    receipt: (ps.receipt as string) ?? '',
    versionHistory: (ps.versionHistory as VersionRecord[]) ?? [],
  } as ParamSet
}

const loadSavedParamSets = (): ParamSet[] => {
  try {
    const raw = localStorage.getItem('dc-saved-params')
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>[]
    return parsed.map(migrateParamSet)
  } catch { return [] }
}

const saveToStorage = (sets: ParamSet[]) => {
  localStorage.setItem('dc-saved-params', JSON.stringify(sets))
}

const initialDerived = computeDerived(defaultParamSet)

export const useStore = create<DCStore>((set, get) => ({
  paramSet: defaultParamSet,
  anomalies: initialDerived.anomalies,
  airflowSamples: initialDerived.airflowSamples,
  score: initialDerived.score,
  savedParamSets: loadSavedParamSets(),
  compareLeftId: null,
  compareRightId: null,
  selectedAnomalyId: null,
  paramPanelOpen: false,
  anomalyPanelOpen: false,
  sectionPlaneY: 0,
  showAirflow: true,
  showHeatmap: true,
  hoveredRackId: null,

  updateParamSet: (partial) => {
    const newPs = { ...get().paramSet, ...partial }
    const derived = computeDerived(newPs)
    set({ paramSet: newPs, ...derived })
  },

  updateRack: (id, partial) => {
    const ps = get().paramSet
    const newRacks = ps.racks.map(r => r.id === id ? { ...r, ...partial } : r)
    const newPs = { ...ps, racks: newRacks }
    const derived = computeDerived(newPs)
    set({ paramSet: newPs, ...derived })
  },

  updateCRAC: (id, partial) => {
    const ps = get().paramSet
    const newCracs = ps.cracUnits.map(c => c.id === id ? { ...c, ...partial } : c)
    const newPs = { ...ps, cracUnits: newCracs }
    const derived = computeDerived(newPs)
    set({ paramSet: newPs, ...derived })
  },

  saveParamSet: (options) => {
    const ps = get().paramSet
    const existing = get().savedParamSets
    const now = Date.now()
    const versionRecord: VersionRecord = {
      version: ps.version,
      timestamp: ps.timestamp,
      name: ps.name,
      notes: ps.notes,
      receipt: ps.receipt,
      snapshot: {
        globalPowerKw: ps.globalPowerKw,
        globalAirflowCfm: ps.globalAirflowCfm,
        aisleGap: ps.aisleGap,
        floorPerforation: ps.floorPerforation,
      },
    }
    const saved: ParamSet = {
      ...ps,
      id: `ps-${now}`,
      name: options.name,
      version: 1,
      notes: options.notes ?? '',
      receipt: options.receipt ?? '',
      timestamp: now,
      versionHistory: [versionRecord],
    }
    const updated = [...existing, saved]
    saveToStorage(updated)
    set({ savedParamSets: updated })
  },

  loadParamSet: (id) => {
    const found = get().savedParamSets.find(s => s.id === id)
    if (!found) return
    const derived = computeDerived(found)
    set({ paramSet: found, ...derived })
  },

  deleteParamSet: (id) => {
    const updated = get().savedParamSets.filter(s => s.id !== id)
    saveToStorage(updated)
    set({ savedParamSets: updated })
  },

  updateSavedParamSetMeta: (id, meta) => {
    const sets = get().savedParamSets
    const target = sets.find(s => s.id === id)
    if (!target) return
    const prevVersionRecord: VersionRecord = {
      version: target.version,
      timestamp: target.timestamp,
      name: target.name,
      notes: target.notes,
      receipt: target.receipt,
      snapshot: {
        globalPowerKw: target.globalPowerKw,
        globalAirflowCfm: target.globalAirflowCfm,
        aisleGap: target.aisleGap,
        floorPerforation: target.floorPerforation,
      },
    }
    const updated: ParamSet = {
      ...target,
      ...meta,
      version: target.version + 1,
      timestamp: Date.now(),
      versionHistory: [...target.versionHistory, prevVersionRecord],
    }
    const newSets = sets.map(s => s.id === id ? updated : s)
    saveToStorage(newSets)
    const currentPs = get().paramSet
    if (currentPs.id === id) {
      set({ paramSet: updated, savedParamSets: newSets })
    } else {
      set({ savedParamSets: newSets })
    }
  },

  setSelectedAnomalyId: (id) => set({ selectedAnomalyId: id }),
  setParamPanelOpen: (open) => set({ paramPanelOpen: open }),
  setAnomalyPanelOpen: (open) => set({ anomalyPanelOpen: open }),
  setSectionPlaneY: (y) => set({ sectionPlaneY: y }),
  setShowAirflow: (show) => set({ showAirflow: show }),
  setShowHeatmap: (show) => set({ showHeatmap: show }),
  setHoveredRackId: (id) => set({ hoveredRackId: id }),

  setCompareIds: (left, right) => set({ compareLeftId: left, compareRightId: right }),

  recalculate: () => {
    const derived = computeDerived(get().paramSet)
    set({ ...derived })
  },
}))

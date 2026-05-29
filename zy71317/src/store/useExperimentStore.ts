import { create } from "zustand"
import type { ExperimentRecord, ParamState, StabilityResult, AnomalyFilterType } from "@/types"
import { determineStability } from "@/utils/physics"
import {
  loadRecords,
  saveRecords,
  createRecord,
  mergeRecords,
} from "@/utils/importExport"
import { logger } from "@/utils/logger"

interface ExperimentStore {
  params: ParamState
  setParam: <K extends keyof ParamState>(key: K, value: ParamState[K]) => void
  currentResult: StabilityResult | null
  updateResult: () => void
  records: ExperimentRecord[]
  loadAllRecords: () => void
  addRecord: (manualNote?: string) => void
  importRecords: (incoming: ExperimentRecord[]) => void
  deleteRecord: (id: string) => void
  clearRecords: () => void
  anomalyFilter: AnomalyFilterType
  setAnomalyFilter: (filter: AnomalyFilterType) => void
  filteredRecords: () => ExperimentRecord[]
  manualNote: string
  setManualNote: (note: string) => void
}

const DEFAULT_PARAMS: ParamState = {
  magnetSpacing: 10,
  vehicleMass: 50,
  trackLength: 500,
  current: 5,
  disturbance: 2,
}

export const useExperimentStore = create<ExperimentStore>((set, get) => ({
  params: { ...DEFAULT_PARAMS },
  currentResult: null,
  records: [],
  anomalyFilter: "all",
  manualNote: "",

  setParam: (key, value) => {
    set((state) => ({
      params: { ...state.params, [key]: value },
    }))
    get().updateResult()
  },

  updateResult: () => {
    const { params } = get()
    const result = determineStability(params)
    set({ currentResult: result })
  },

  loadAllRecords: () => {
    const records = loadRecords()
    set({ records })
    logger.info("load_records", `count=${records.length}`)
  },

  addRecord: (manualNote?: string) => {
    const { params, records } = get()
    const record = createRecord(params, manualNote)
    const next = [...records, record]
    saveRecords(next)
    set({ records: next, manualNote: "" })
  },

  importRecords: (incoming) => {
    const { records } = get()
    const merged = mergeRecords(records, incoming)
    saveRecords(merged)
    set({ records: merged })
  },

  deleteRecord: (id) => {
    const { records } = get()
    const next = records.filter((r) => r.id !== id)
    saveRecords(next)
    set({ records: next })
    logger.info("delete_record", `id=${id}`)
  },

  clearRecords: () => {
    saveRecords([])
    set({ records: [] })
    logger.info("clear_records")
  },

  setAnomalyFilter: (filter) => set({ anomalyFilter: filter }),

  filteredRecords: () => {
    const { records, anomalyFilter } = get()
    if (anomalyFilter === "all") return records
    return records.filter((r) => r.result.anomalyType === anomalyFilter)
  },

  setManualNote: (note) => set({ manualNote: note }),
}))

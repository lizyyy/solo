import { create } from "zustand"
import type { ExperimentRecord, DataQualityFlag } from "@/types"
import { MOCK_RECORDS } from "@/utils/mockData"
import { scanDataQuality } from "@/utils/dataQuality"

interface DataStore {
  records: ExperimentRecord[]
  isLoaded: boolean
  loadData: () => void
  updateFlagStatus: (recordId: string, flagId: string, status: DataQualityFlag["status"]) => void
  updateRecord: (recordId: string, updates: Partial<ExperimentRecord>) => void
  resolveConflict: (recordId: string, action: string) => void
}

export const useDataStore = create<DataStore>((set, get) => ({
  records: [],
  isLoaded: false,

  loadData: () => {
    const thresholdMax = 250
    const scanned = scanDataQuality(MOCK_RECORDS, thresholdMax)
    set({ records: scanned, isLoaded: true })
  },

  updateFlagStatus: (recordId, flagId, status) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              dataQualityFlags: r.dataQualityFlags.map((f) =>
                f.id === flagId ? { ...f, status } : f
              ),
            }
          : r
      ),
    }))
  },

  updateRecord: (recordId, updates) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId ? { ...r, ...updates } : r
      ),
    }))
  },

  resolveConflict: (recordId, action) => {
    const record = get().records.find((r) => r.id === recordId)
    if (!record) return

    if (action === "按备注修正" && record.conflictDetail) {
      set((state) => ({
        records: state.records.map((r) =>
          r.id === recordId
            ? { ...r, conflictWithNote: false, rawNote: `${r.rawNote} [已按备注处理: ${action}]` }
            : r
        ),
      }))
    } else if (action === "按数据保留") {
      set((state) => ({
        records: state.records.map((r) =>
          r.id === recordId
            ? { ...r, conflictWithNote: false, rawNote: `${r.rawNote} [已按数据保留]` }
            : r
        ),
      }))
    } else {
      set((state) => ({
        records: state.records.map((r) =>
          r.id === recordId
            ? { ...r, rawNote: `${r.rawNote} [暂不处理]` }
            : r
        ),
      }))
    }
  },
}))

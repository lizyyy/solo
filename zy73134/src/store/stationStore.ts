import { create } from 'zustand'
import { StationRecord, ViewMode, AnomalyFilterKey } from '@/types/station'
import sampleStations from '@/data/sampleStations'

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

const formatBatchTimestamp = (): string => {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const getLatestByStationFromRecords = (records: StationRecord[]): StationRecord[] => {
  const map = new Map<string, StationRecord>()

  for (const r of records) {
    const existing = map.get(r.station_code)
    if (!existing) {
      map.set(r.station_code, r)
      continue
    }

    const existingPriority = existing.status !== '原始' ? 1 : 0
    const newPriority = r.status !== '原始' ? 1 : 0

    if (newPriority > existingPriority) {
      map.set(r.station_code, r)
    } else if (newPriority === existingPriority) {
      if (new Date(r.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
        map.set(r.station_code, r)
      }
    }
  }

  return Array.from(map.values())
}

export const useStationStore = create<{
  records: StationRecord[]
  viewMode: ViewMode
  searchKeyword: string
  selectedId: string | null
  anomalyFilters: Record<AnomalyFilterKey, boolean>
  showExportPanel: boolean
  setViewMode: (v: ViewMode) => void
  setSearchKeyword: (kw: string) => void
  selectStation: (id: string | null) => void
  toggleAnomalyFilter: (k: AnomalyFilterKey) => void
  resetFilters: () => void
  setShowExportPanel: (b: boolean) => void
  updateRemark: (id: string, remark: string) => void
  getLatestByStation: () => StationRecord[]
}>((set, get) => ({
  records: deepClone(sampleStations),
  viewMode: 'global',
  searchKeyword: '',
  selectedId: null,
  anomalyFilters: {
    cloud_heavy: true,
    time_conflict: true,
    result_abnormal: true,
  },
  showExportPanel: false,

  setViewMode: (v) => set({ viewMode: v }),

  setSearchKeyword: (kw) => set({ searchKeyword: kw }),

  selectStation: (id) => set({ selectedId: id }),

  toggleAnomalyFilter: (k) =>
    set((state) => ({
      anomalyFilters: {
        ...state.anomalyFilters,
        [k]: !state.anomalyFilters[k],
      },
    })),

  resetFilters: () =>
    set({
      anomalyFilters: {
        cloud_heavy: true,
        time_conflict: true,
        result_abnormal: true,
      },
      searchKeyword: '',
    }),

  setShowExportPanel: (b) => set({ showExportPanel: b }),

  updateRemark: (id, remark) =>
    set((state) => {
      const original = state.records.find((r) => r.id === id)
      if (!original) return state

      const newRecord: StationRecord = {
        ...deepClone(original),
        id: generateId(),
        batch_id: `BATCH-${formatBatchTimestamp()}-REV`,
        status: '已核对',
        remark,
        updated_at: new Date().toISOString(),
        derived_from: original.id,
      }

      return {
        records: [...state.records, newRecord],
        selectedId: newRecord.id,
      }
    }),

  getLatestByStation: () => getLatestByStationFromRecords(get().records),
}))

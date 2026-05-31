import { create } from "zustand"
import type { TimelineRecord, InspectionRecord, WeeklyReportItem, RecordSource, RecordStatus } from "@/types"
import { timelineRecords, inspectionRecords, weeklyReportItems } from "@/mockData"

interface AppState {
  timelineRecords: TimelineRecord[]
  inspectionRecords: InspectionRecord[]
  weeklyReportItems: WeeklyReportItem[]
  selectedInspectionId: string | null
  sourceFilter: RecordSource[]
  statusFilter: RecordStatus[]
  setSelectedInspectionId: (id: string | null) => void
  toggleSourceFilter: (source: RecordSource) => void
  toggleStatusFilter: (status: RecordStatus) => void
  clearFilters: () => void
  filteredTimeline: () => TimelineRecord[]
  ingestData: (records: InspectionRecord[]) => void
}

export const useStore = create<AppState>((set, get) => ({
  timelineRecords,
  inspectionRecords,
  weeklyReportItems,
  selectedInspectionId: null,
  sourceFilter: [],
  statusFilter: [],
  setSelectedInspectionId: (id) => set({ selectedInspectionId: id }),
  toggleSourceFilter: (source) =>
    set((state) => {
      const exists = state.sourceFilter.includes(source)
      return {
        sourceFilter: exists
          ? state.sourceFilter.filter((s) => s !== source)
          : [...state.sourceFilter, source],
      }
    }),
  toggleStatusFilter: (status) =>
    set((state) => {
      const exists = state.statusFilter.includes(status)
      return {
        statusFilter: exists
          ? state.statusFilter.filter((s) => s !== status)
          : [...state.statusFilter, status],
      }
    }),
  clearFilters: () => set({ sourceFilter: [], statusFilter: [] }),
  filteredTimeline: () => {
    const { timelineRecords, sourceFilter, statusFilter } = get()
    return timelineRecords.filter((r) => {
      if (sourceFilter.length > 0 && !sourceFilter.includes(r.source)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false
      return true
    })
  },
  ingestData: (records) =>
    set((state) => ({
      inspectionRecords: [...state.inspectionRecords, ...records],
    })),
}))

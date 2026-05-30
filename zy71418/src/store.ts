import { create } from 'zustand'
import type { ReconciliationRecord, FilterState, ReconciliationStatus } from './types'
import { getRecords } from './mockData'

interface ReconciliationStore {
  records: ReconciliationRecord[]
  selectedIds: Set<string>
  filters: FilterState
  setRecords: (records: ReconciliationRecord[]) => void
  toggleSelect: (id: string) => void
  toggleSelectAll: (ids: string[]) => void
  clearSelection: () => void
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  updateStatus: (ids: string[], status: ReconciliationStatus) => void
  filteredRecords: () => ReconciliationRecord[]
}

const defaultFilters: FilterState = {
  brokerIds: [],
  dateRange: null,
  diffTypes: [],
  statuses: [],
  markets: [],
}

export const useReconciliationStore = create<ReconciliationStore>((set, get) => ({
  records: getRecords(),
  selectedIds: new Set<string>(),
  filters: { ...defaultFilters },

  setRecords: (records) => set({ records }),

  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    }),

  toggleSelectAll: (ids) =>
    set((state) => {
      const allSelected = ids.every(id => state.selectedIds.has(id))
      const next = new Set(state.selectedIds)
      if (allSelected) {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return { selectedIds: next }
    }),

  clearSelection: () => set({ selectedIds: new Set<string>() }),

  setFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  updateStatus: (ids, status) =>
    set((state) => ({
      records: state.records.map(r =>
        ids.includes(r.id) ? { ...r, status, updatedAt: new Date().toISOString() } : r
      ),
    })),

  filteredRecords: () => {
    const { records, filters } = get()
    return records.filter((r) => {
      if (filters.brokerIds.length > 0 && !filters.brokerIds.includes(r.brokerId)) return false
      if (filters.dateRange) {
        const d = new Date(r.createdAt).getTime()
        const [start, end] = filters.dateRange
        if (d < new Date(start).getTime() || d > new Date(end + 'T23:59:59').getTime()) return false
      }
      if (filters.diffTypes.length > 0 && !filters.diffTypes.some(dt => r.diffTypes.includes(dt))) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(r.status)) return false
      if (filters.markets.length > 0 && !filters.markets.includes(r.market)) return false
      return true
    })
  },
}))

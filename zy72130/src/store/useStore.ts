import { create } from 'zustand'
import type { RevenueRecord, JudgmentStep, FilterState, ImportResult } from '@/types'

interface AppState {
  records: RevenueRecord[]
  currentRecord: RevenueRecord | null
  judgments: JudgmentStep[]
  filter: FilterState
  loading: boolean
  importResult: ImportResult | null
  editingNoteId: string | null

  setFilter: (filter: Partial<FilterState>) => void
  fetchRecords: () => Promise<void>
  fetchRecord: (id: string) => Promise<void>
  fetchJudgments: (id: string) => Promise<void>
  updateRecord: (id: string, data: Record<string, unknown>) => Promise<void>
  importFiles: (files: FileList) => Promise<void>
  clearImportResult: () => void
  setEditingNoteId: (id: string | null) => void
}

export const useStore = create<AppState>((set, get) => ({
  records: [],
  currentRecord: null,
  judgments: [],
  filter: { status: '', source: '', dateFrom: '', dateTo: '', sortBy: 'createdAt', sortOrder: 'desc' },
  loading: false,
  importResult: null,
  editingNoteId: null,

  setFilter: (partial) => {
    const filter = { ...get().filter, ...partial }
    set({ filter })
    get().fetchRecords()
  },

  fetchRecords: async () => {
    set({ loading: true })
    try {
      const { filter } = get()
      const params = new URLSearchParams()
      if (filter.status) params.set('status', filter.status)
      if (filter.source) params.set('source', filter.source)
      if (filter.dateFrom) params.set('dateFrom', filter.dateFrom)
      if (filter.dateTo) params.set('dateTo', filter.dateTo)
      if (filter.sortBy) params.set('sortBy', filter.sortBy)
      if (filter.sortOrder) params.set('sortOrder', filter.sortOrder)

      const res = await fetch(`/api/records?${params.toString()}`)
      const data = await res.json()
      set({ records: data.records || [], loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchRecord: async (id) => {
    set({ loading: true })
    try {
      const res = await fetch(`/api/records/${id}`)
      const data = await res.json()
      set({ currentRecord: data.record, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchJudgments: async (id) => {
    try {
      const res = await fetch(`/api/records/${id}/judgments`)
      const data = await res.json()
      set({ judgments: data.judgments || [] })
    } catch {
      set({ judgments: [] })
    }
  },

  updateRecord: async (id, data) => {
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.record) {
        set((state) => ({
          records: state.records.map((r) => (r.id === id ? result.record : r)),
          currentRecord: state.currentRecord?.id === id ? result.record : state.currentRecord,
        }))
      }
    } catch (err) {
      console.error('更新失败:', err)
    }
  },

  importFiles: async (files) => {
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      set({ importResult: result })
      get().fetchRecords()
    } catch (err) {
      console.error('导入失败:', err)
    }
  },

  clearImportResult: () => set({ importResult: null }),
  setEditingNoteId: (id) => set({ editingNoteId: id }),
}))

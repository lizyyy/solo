import { create } from 'zustand'
import type {
  DepositRecord,
  RecordSummary,
  RecordDetailResponse,
  RecordsResponse,
  RejudgeRequest,
  RollbackRequest,
  SupplementRequest,
} from '../../shared/types'

interface Filters {
  status: string
  start_date: string
  end_date: string
  min_amount: string
  max_amount: string
  search: string
}

interface RecordStore {
  records: DepositRecord[]
  summary: RecordSummary
  filters: Filters
  loading: boolean
  detail: RecordDetailResponse | null
  detailLoading: boolean
  fetchRecords: () => Promise<void>
  setFilters: (filters: Partial<Filters>) => void
  exportCsv: () => void
  fetchDetail: (id: string) => Promise<void>
  rejudge: (id: string, data: RejudgeRequest) => Promise<void>
  rollback: (id: string, data: RollbackRequest) => Promise<void>
  supplement: (id: string, data: SupplementRequest) => Promise<void>
}

export const useRecordStore = create<RecordStore>((set, get) => ({
  records: [],
  summary: { confirmed_total: 0, suspended_total: 0, total_count: 0 },
  filters: {
    status: '',
    start_date: '',
    end_date: '',
    min_amount: '',
    max_amount: '',
    search: '',
  },
  loading: false,
  detail: null,
  detailLoading: false,

  fetchRecords: async () => {
    set({ loading: true })
    try {
      const { filters } = get()
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.start_date) params.set('start_date', filters.start_date)
      if (filters.end_date) params.set('end_date', filters.end_date)
      if (filters.min_amount) params.set('min_amount', filters.min_amount)
      if (filters.max_amount) params.set('max_amount', filters.max_amount)
      if (filters.search) params.set('keyword', filters.search)
      const res = await fetch(`/api/records?${params}`)
      const raw = await res.json()
      if (raw.success) {
        set({ records: raw.data, summary: raw.summary, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters } }))
  },

  exportCsv: () => {
    const { filters } = get()
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.start_date) params.set('start_date', filters.start_date)
    if (filters.end_date) params.set('end_date', filters.end_date)
    if (filters.min_amount) params.set('min_amount', filters.min_amount)
    if (filters.max_amount) params.set('max_amount', filters.max_amount)
    if (filters.search) params.set('keyword', filters.search)
    window.open(`/api/records/export?${params}`, '_blank')
  },

  fetchDetail: async (id) => {
    set({ detailLoading: true })
    try {
      const res = await fetch(`/api/records/${id}`)
      const raw = await res.json()
      if (raw.success) {
        set({ detail: { data: raw.data, attachments: raw.attachments, audit_logs: raw.audit_logs }, detailLoading: false })
      } else {
        set({ detailLoading: false })
      }
    } catch {
      set({ detailLoading: false })
    }
  },

  rejudge: async (id, body) => {
    await fetch(`/api/records/${id}/rejudge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await get().fetchDetail(id)
  },

  rollback: async (id, body) => {
    await fetch(`/api/records/${id}/rollback`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await get().fetchDetail(id)
  },

  supplement: async (id, body) => {
    await fetch(`/api/records/${id}/supplement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await get().fetchDetail(id)
  },
}))

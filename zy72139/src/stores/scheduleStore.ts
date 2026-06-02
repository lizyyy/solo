import { create } from 'zustand'

export interface ScheduleItem {
  id: number
  part_no: string
  track_name: string | null
  file_name: string | null
  source: string
  version: number
  status: string
  remark: string
  original_source: string
  processed_at: string
  modified_by: string
  modified_at: string
  created_at: string
}

export interface AuditLogItem {
  id: number
  schedule_id: number
  field: string
  old_value: string
  new_value: string
  operator: string
  operated_at: string
}

interface ScheduleState {
  items: ScheduleItem[]
  auditLogs: AuditLogItem[]
  loading: boolean
  filters: {
    status: string
    source: string
    keyword: string
  }
  operatorName: string
  selectedId: number | null
  showAuditDrawer: boolean
  showAddModal: boolean

  setFilters: (filters: Partial<ScheduleState['filters']>) => void
  setOperatorName: (name: string) => void
  setSelectedId: (id: number | null) => void
  setShowAuditDrawer: (show: boolean) => void
  setShowAddModal: (show: boolean) => void

  fetchSchedules: () => Promise<void>
  updateSchedule: (id: number, data: { remark?: string; status?: string }) => Promise<void>
  deleteSchedule: (id: number) => Promise<void>
  addSchedule: (data: Partial<ScheduleItem>) => Promise<void>
  fetchAuditLogs: (id: number) => Promise<void>
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  items: [],
  auditLogs: [],
  loading: false,
  filters: { status: '', source: '', keyword: '' },
  operatorName: '',
  selectedId: null,
  showAuditDrawer: false,
  showAddModal: false,

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  setOperatorName: (name) => set({ operatorName: name }),
  setSelectedId: (id) => set({ selectedId: id }),
  setShowAuditDrawer: (show) => set({ showAuditDrawer: show }),
  setShowAddModal: (show) => set({ showAddModal: show }),

  fetchSchedules: async () => {
    set({ loading: true })
    const { filters } = get()
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.source) params.set('source', filters.source)
    if (filters.keyword) params.set('keyword', filters.keyword)
    const qs = params.toString()
    const url = `/api/schedules${qs ? '?' + qs : ''}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.success) {
      set({ items: json.data, loading: false })
    } else {
      set({ loading: false })
    }
  },

  updateSchedule: async (id, data) => {
    const { operatorName } = get()
    const res = await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, modified_by: operatorName || '未知' }),
    })
    const json = await res.json()
    if (json.success) {
      await get().fetchSchedules()
    }
  },

  deleteSchedule: async (id) => {
    const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      await get().fetchSchedules()
    }
  },

  addSchedule: async (data) => {
    const { operatorName } = get()
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, modified_by: operatorName || '未知' }),
    })
    const json = await res.json()
    if (json.success) {
      await get().fetchSchedules()
    }
  },

  fetchAuditLogs: async (id) => {
    const res = await fetch(`/api/schedules/${id}/audit-logs`)
    const json = await res.json()
    if (json.success) {
      set({ auditLogs: json.data })
    }
  },
}))

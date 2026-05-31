import { create } from 'zustand'
import type { QueueRecord, RecordDetail, AuditLog, CreateRecordRequest, UpdateStatusRequest, SourceType, StatusType } from '@shared/types'

interface QueueStore {
  records: QueueRecord[]
  currentRecord: RecordDetail | null
  auditLogs: AuditLog[]
  loading: boolean
  error: string | null
  filters: {
    source?: SourceType
    status?: StatusType
    search?: string
  }
  submitResult: {
    isDuplicate: boolean
    relatedExistingId?: string
  } | null

  fetchRecords: () => Promise<void>
  fetchRecordDetail: (id: string) => Promise<void>
  fetchAuditLogs: (filters?: { operator?: string; recordId?: string }) => Promise<void>
  createRecord: (data: CreateRecordRequest) => Promise<void>
  updateStatus: (id: string, data: UpdateStatusRequest) => Promise<void>
  setFilters: (filters: Partial<QueueStore['filters']>) => void
  clearError: () => void
  clearSubmitResult: () => void
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  records: [],
  currentRecord: null,
  auditLogs: [],
  loading: false,
  error: null,
  filters: {},
  submitResult: null,

  fetchRecords: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      const params = new URLSearchParams()
      if (filters.source) params.set('source', filters.source)
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)
      const res = await fetch(`/api/records?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        set({ records: json.data, loading: false })
      } else {
        set({ error: json.error || '获取记录失败', loading: false })
      }
    } catch (e) {
      set({ error: '网络错误', loading: false })
    }
  },

  fetchRecordDetail: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/records/${id}`)
      const json = await res.json()
      if (json.success) {
        set({ currentRecord: json.data, loading: false })
      } else {
        set({ error: json.error || '获取详情失败', loading: false })
      }
    } catch (e) {
      set({ error: '网络错误', loading: false })
    }
  },

  fetchAuditLogs: async (filters?: { operator?: string; recordId?: string }) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters?.operator) params.set('operator', filters.operator)
      if (filters?.recordId) params.set('recordId', filters.recordId)
      const res = await fetch(`/api/records/audit?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        set({ auditLogs: json.data, loading: false })
      } else {
        set({ error: json.error || '获取审计日志失败', loading: false })
      }
    } catch (e) {
      set({ error: '网络错误', loading: false })
    }
  },

  createRecord: async (data: CreateRecordRequest) => {
    set({ loading: true, error: null, submitResult: null })
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.success) {
        set({
          submitResult: {
            isDuplicate: json.isDuplicate || false,
            relatedExistingId: json.relatedExistingId,
          },
          loading: false,
        })
        await get().fetchRecords()
      } else {
        set({ error: json.error || '创建失败', loading: false })
      }
    } catch (e) {
      set({ error: '网络错误', loading: false })
    }
  },

  updateStatus: async (id: string, data: UpdateStatusRequest) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/records/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.success) {
        set({ currentRecord: json.data, loading: false })
        await get().fetchRecords()
      } else {
        set({ error: json.error || '状态更新失败', loading: false })
      }
    } catch (e) {
      set({ error: '网络错误', loading: false })
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }))
  },

  clearError: () => set({ error: null }),
  clearSubmitResult: () => set({ submitResult: null }),
}))

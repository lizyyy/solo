import { create } from 'zustand'
import { fetchApi } from '@/lib/api'
import type { LedgerRecord, Stats, OperationLog } from '@/types'

interface LedgerState {
  records: LedgerRecord[]
  currentRecord: LedgerRecord | null
  stats: Stats
  auditLogs: OperationLog[]
  loading: boolean
  error: string | null
  fetchRecords: (status?: string) => Promise<void>
  fetchRecordById: (id: string) => Promise<void>
  fetchStats: () => Promise<void>
  importRecords: (records: any[], operator?: string) => Promise<void>
  supplementTaxRate: (id: string, rate: number, remark: string, operator?: string) => Promise<void>
  correctRecord: (id: string, field: string, value: string, operator?: string) => Promise<void>
  rerunDetection: (recordId?: string, operator?: string) => Promise<void>
  confirmRecord: (id: string, operator?: string) => Promise<void>
  rejectRecord: (id: string, operator?: string) => Promise<void>
  fetchAuditLogs: (recordId?: string) => Promise<void>
  seedDemoData: () => Promise<void>
  clearError: () => void
}

export const useLedgerStore = create<LedgerState>((set) => ({
  records: [],
  currentRecord: null,
  stats: { normal: 0, inconsistent: 0, supplemented: 0, confirmed: 0, total: 0 },
  auditLogs: [],
  loading: false,
  error: null,

  fetchRecords: async (status?: string) => {
    set({ loading: true, error: null })
    try {
      const query = status ? `?status=${status}` : ''
      const data = await fetchApi<LedgerRecord[]>(query)
      set({ records: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchRecordById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const data = await fetchApi<LedgerRecord>(`/${id}`)
      set({ currentRecord: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchStats: async () => {
    try {
      const data = await fetchApi<Stats>('/stats')
      set({ stats: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  importRecords: async (records: any[], operator?: string) => {
    set({ loading: true, error: null })
    try {
      await fetchApi<any>('/import', {
        method: 'POST',
        body: JSON.stringify({ records, operator }),
      })
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  supplementTaxRate: async (id: string, rate: number, remark: string, operator?: string) => {
    set({ loading: true, error: null })
    try {
      await fetchApi<any>(`/${id}/supplement`, {
        method: 'PUT',
        body: JSON.stringify({ rate, remark, operator }),
      })
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  correctRecord: async (id: string, field: string, value: string, operator?: string) => {
    set({ loading: true, error: null })
    try {
      await fetchApi<any>(`/${id}/correct`, {
        method: 'PUT',
        body: JSON.stringify({ field, value, operator }),
      })
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  rerunDetection: async (recordId?: string, operator?: string) => {
    set({ loading: true, error: null })
    try {
      await fetchApi<any>('/rerun', {
        method: 'POST',
        body: JSON.stringify({ recordId, operator }),
      })
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  confirmRecord: async (id: string, operator?: string) => {
    set({ loading: true, error: null })
    try {
      await fetchApi<any>(`/${id}/confirm`, {
        method: 'PUT',
        body: JSON.stringify({ operator }),
      })
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  rejectRecord: async (id: string, operator?: string) => {
    set({ loading: true, error: null })
    try {
      await fetchApi<any>(`/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ operator }),
      })
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchAuditLogs: async (recordId?: string) => {
    set({ loading: true, error: null })
    try {
      const query = recordId ? `?recordId=${recordId}` : ''
      const data = await fetchApi<OperationLog[]>(`/audit-logs${query}`)
      set({ auditLogs: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  seedDemoData: async () => {
    set({ loading: true, error: null })
    try {
      await fetchApi<any>('/demo/seed', { method: 'POST' })
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))

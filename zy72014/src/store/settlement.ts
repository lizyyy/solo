import { create } from 'zustand'
import type { Settlement, SettlementDetail, StatusFilter } from '@shared/types'

interface SettlementStore {
  settlements: Settlement[]
  currentDetail: SettlementDetail | null
  statusFilter: StatusFilter
  loading: boolean
  error: string | null
  fetchSettlements: () => Promise<void>
  fetchSettlementsByStatus: (status: StatusFilter) => Promise<void>
  fetchDetail: (id: string) => Promise<void>
  override: (id: string, field: string, newValue: string, reason: string) => Promise<void>
  rollback: (id: string, reason: string) => Promise<void>
  reload: () => Promise<void>
  setStatusFilter: (filter: StatusFilter) => void
  exportCsv: () => Promise<void>
}

export const useSettlementStore = create<SettlementStore>((set, get) => ({
  settlements: [],
  currentDetail: null,
  statusFilter: 'all',
  loading: false,
  error: null,

  fetchSettlements: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/settlements')
      const data = await res.json()
      set({ settlements: data, loading: false })
    } catch (e) {
      set({ error: '获取结算列表失败', loading: false })
    }
  },

  fetchSettlementsByStatus: async (status: StatusFilter) => {
    set({ loading: true, error: null })
    try {
      const url = status === 'all' ? '/api/settlements' : `/api/settlements?status=${status}`
      const res = await fetch(url)
      const data = await res.json()
      set({ settlements: data, loading: false })
    } catch (e) {
      set({ error: '获取结算列表失败', loading: false })
    }
  },

  fetchDetail: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/settlements/${id}`)
      const data = await res.json()
      set({ currentDetail: data, loading: false })
    } catch (e) {
      set({ error: '获取结算详情失败', loading: false })
    }
  },

  override: async (id: string, field: string, newValue: string, reason: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/settlements/${id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, newValue, reason }),
      })
      if (!res.ok) {
        const err = await res.json()
        set({ error: err.error || '改判失败', loading: false })
        return
      }
      await get().fetchDetail(id)
      await get().fetchSettlementsByStatus(get().statusFilter)
    } catch (e) {
      set({ error: '改判操作失败', loading: false })
    }
  },

  rollback: async (id: string, reason: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/settlements/${id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const err = await res.json()
        set({ error: err.error || '回退失败', loading: false })
        return
      }
      await get().fetchDetail(id)
      await get().fetchSettlementsByStatus(get().statusFilter)
    } catch (e) {
      set({ error: '回退操作失败', loading: false })
    }
  },

  reload: async () => {
    set({ loading: true, error: null })
    try {
      await fetch('/api/settlements/reload', { method: 'POST' })
      await get().fetchSettlementsByStatus(get().statusFilter)
    } catch (e) {
      set({ error: '重新加载数据失败', loading: false })
    }
  },

  setStatusFilter: (filter: StatusFilter) => {
    set({ statusFilter: filter })
    get().fetchSettlementsByStatus(filter)
  },

  exportCsv: async () => {
    try {
      const res = await fetch('/api/settlements/export')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'settlement-export.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      set({ error: '导出失败' })
    }
  },
}))

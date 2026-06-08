import { create } from 'zustand'
import type {
  CoordinateRecord,
  StatsResponse,
  AuditLog,
  BoundaryRule,
  InspectionPhoto,
  ImportResponse,
  ReviewRequest,
  RollbackRequest,
  OperatorRole,
} from '@shared/types'

interface AppState {
  records: CoordinateRecord[]
  stats: StatsResponse | null
  auditLogs: AuditLog[]
  rules: BoundaryRule[]
  currentRecord: CoordinateRecord | null
  photos: InspectionPhoto[]
  loading: boolean
  error: string | null
  role: OperatorRole

  fetchRecords: (params?: Record<string, string>) => Promise<void>
  fetchStats: () => Promise<void>
  fetchAuditLogs: (recordId: string) => Promise<void>
  fetchRules: () => Promise<void>
  importFile: (file: File, operator: string) => Promise<ImportResponse | null>
  submitReview: (req: ReviewRequest) => Promise<void>
  confirmRecord: (recordId: string, operator: string) => Promise<void>
  rollbackRecord: (req: RollbackRequest) => Promise<void>
  setCurrentRecord: (record: CoordinateRecord | null) => void
  fetchPhotos: (recordId: string) => Promise<void>
  setRole: (role: OperatorRole) => void
  setAuditLogs: (logs: AuditLog[]) => void
  clearError: () => void
}

export const useStore = create<AppState>((set, get) => ({
  records: [],
  stats: null,
  auditLogs: [],
  rules: [],
  currentRecord: null,
  photos: [],
  loading: false,
  error: null,
  role: 'instructor',

  clearError: () => set({ error: null }),

  fetchRecords: async (params) => {
    set({ loading: true, error: null })
    try {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      const res = await fetch(`/api/records${query}`)
      if (!res.ok) throw new Error('获取记录失败')
      const data = await res.json()
      set({ records: data.data || data, loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, loading: false })
    }
  },

  fetchStats: async () => {
    set({ error: null })
    try {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('获取统计失败')
      const data = await res.json()
      set({ stats: data.data || data })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
    }
  },

  fetchAuditLogs: async (recordId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/audit/${recordId}`)
      if (!res.ok) throw new Error('获取审计日志失败')
      const data = await res.json()
      set({ auditLogs: data.data || data, loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, loading: false })
    }
  },

  fetchRules: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/rules')
      if (!res.ok) throw new Error('获取规则失败')
      const data = await res.json()
      set({ rules: data.data || data, loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, loading: false })
    }
  },

  importFile: async (file, operator) => {
    set({ loading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('operator', operator)
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('导入失败')
      const data = await res.json()
      const result: ImportResponse = data.data || data
      set((state) => ({
        records: [...result.records, ...state.records],
        loading: false,
      }))
      get().fetchStats()
      return result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, loading: false })
      return null
    }
  },

  submitReview: async (req) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      if (!res.ok) throw new Error('提交复核失败')
      await get().fetchRecords()
      get().fetchStats()
      set({ loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, loading: false })
    }
  },

  confirmRecord: async (recordId, operator) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: recordId, operator }),
      })
      if (!res.ok) throw new Error('确认失败')
      await get().fetchRecords()
      get().fetchStats()
      set({ loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, loading: false })
    }
  },

  rollbackRecord: async (req) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, operator_role: get().role }),
      })
      if (!res.ok) throw new Error('回滚失败')
      await get().fetchRecords()
      get().fetchStats()
      if (get().currentRecord) {
        await get().fetchAuditLogs(get().currentRecord!.id)
      }
      set({ loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, loading: false })
    }
  },

  setCurrentRecord: (record) => set({ currentRecord: record }),

  fetchPhotos: async (recordId) => {
    set({ error: null })
    try {
      const res = await fetch(`/api/photos/${recordId}`)
      if (!res.ok) throw new Error('获取照片失败')
      const data = await res.json()
      set({ photos: data.data || data })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
    }
  },

  setRole: (role) => set({ role }),
  setAuditLogs: (logs) => set({ auditLogs: logs }),
}))

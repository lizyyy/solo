import { create } from 'zustand'

interface Material {
  id: number
  name: string
  min_energy_density: number
  max_energy_density: number
  recommended_power: number
  recommended_speed: number
  focal_range_min: number
  focal_range_max: number
}

interface ProcessRecord {
  id: number
  material_id: number
  material_name: string
  laser_power: number
  move_speed: number
  focal_length: number
  line_width: number
  energy_density: number
  status: 'draft' | 'validated' | 'approved' | 'archived' | 'withdrawn'
  is_retroactive: number
  risk_level: 'safe' | 'warning' | 'danger'
  risk_messages: string
  operator: string
  reviewer: string | null
  created_at: string
  updated_at: string
}

interface AuditLog {
  id: number
  record_id: number
  action: string
  operator: string
  changes: string
  reason: string | null
  created_at: string
}

interface ValidationResult {
  energy_density: number
  risk_level: 'safe' | 'warning' | 'danger'
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

interface SweepPoint {
  value: number
  energy_density: number
  risk_level: string
}

interface AppState {
  materials: Material[]
  records: ProcessRecord[]
  auditLogs: AuditLog[]
  validation: ValidationResult | null
  sweepResult: { variable: string; points: SweepPoint[] } | null
  loading: boolean
  error: string | null

  fetchMaterials: () => Promise<void>
  addMaterial: (m: Omit<Material, 'id'>) => Promise<void>
  updateMaterial: (id: number, m: Partial<Material>) => Promise<void>
  deleteMaterial: (id: number) => Promise<void>

  fetchRecords: (filters?: Record<string, string>) => Promise<void>
  createRecord: (data: any) => Promise<ProcessRecord | null>
  updateRecord: (id: number, data: any) => Promise<void>
  validateRecord: (id: number) => Promise<void>
  approveRecord: (id: number, reviewer: string) => Promise<void>
  rejectRecord: (id: number, reason: string, operator: string) => Promise<void>
  withdrawRecord: (id: number, reason: string, operator: string) => Promise<void>
  retroactRecord: (id: number) => Promise<void>
  archiveRecord: (id: number, operator: string) => Promise<void>
  reactivateRecord: (id: number, operator: string) => Promise<void>

  fetchAuditLogs: (recordId: number) => Promise<void>
  clearAuditLogs: () => void

  runValidation: (data: any) => Promise<void>
  runSweep: (data: any) => Promise<void>
  clearValidation: () => void
  clearSweep: () => void

  generateReport: (data: any) => Promise<string | null>
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '请求失败')
  return json.data as T
}

export const useStore = create<AppState>((set, get) => ({
  materials: [],
  records: [],
  auditLogs: [],
  validation: null,
  sweepResult: null,
  loading: false,
  error: null,

  fetchMaterials: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<Material[]>('/api/materials')
      set({ materials: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  addMaterial: async (m) => {
    try {
      await api('/api/materials', { method: 'POST', body: JSON.stringify(m) })
      await get().fetchMaterials()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  updateMaterial: async (id, m) => {
    try {
      await api(`/api/materials/${id}`, { method: 'PUT', body: JSON.stringify(m) })
      await get().fetchMaterials()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteMaterial: async (id) => {
    try {
      await api(`/api/materials/${id}`, { method: 'DELETE' })
      await get().fetchMaterials()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchRecords: async (filters) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams(filters || {})
      const data = await api<ProcessRecord[]>(`/api/records?${params}`)
      set({ records: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createRecord: async (data) => {
    try {
      const record = await api<ProcessRecord>('/api/records', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchRecords()
      return record
    } catch (e: any) {
      set({ error: e.message })
      return null
    }
  },

  updateRecord: async (id, data) => {
    try {
      await api(`/api/records/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  validateRecord: async (id) => {
    try {
      await api(`/api/records/${id}/validate`, { method: 'POST', body: JSON.stringify({}) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  approveRecord: async (id, reviewer) => {
    try {
      await api(`/api/records/${id}/approve`, { method: 'POST', body: JSON.stringify({ reviewer }) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  rejectRecord: async (id, reason, operator) => {
    try {
      await api(`/api/records/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason, operator }) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  withdrawRecord: async (id, reason, operator) => {
    try {
      await api(`/api/records/${id}/withdraw`, { method: 'POST', body: JSON.stringify({ reason, operator }) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  retroactRecord: async (id) => {
    try {
      await api(`/api/records/${id}/retroact`, { method: 'POST', body: JSON.stringify({}) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  archiveRecord: async (id, operator) => {
    try {
      await api(`/api/records/${id}/archive`, { method: 'POST', body: JSON.stringify({ operator }) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  reactivateRecord: async (id, operator) => {
    try {
      await api(`/api/records/${id}/reactivate`, { method: 'POST', body: JSON.stringify({ operator }) })
      await get().fetchRecords()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchAuditLogs: async (recordId) => {
    try {
      const data = await api<AuditLog[]>(`/api/records/${recordId}/audit-logs`)
      set({ auditLogs: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearAuditLogs: () => set({ auditLogs: [] }),

  runValidation: async (data) => {
    try {
      const result = await api<ValidationResult>('/api/validate', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      set({ validation: result })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  runSweep: async (data) => {
    set({ loading: true, error: null })
    try {
      const result = await api<{ variable: string; points: SweepPoint[] }>('/api/sweep', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      set({ sweepResult: result, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  clearValidation: () => set({ validation: null }),
  clearSweep: () => set({ sweepResult: null }),

  generateReport: async (data) => {
    try {
      const result = await api<{ html: string }>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return result.html
    } catch (e: any) {
      set({ error: e.message })
      return null
    }
  },
}))

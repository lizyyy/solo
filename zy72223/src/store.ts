import { create } from 'zustand'

interface Settlement {
  id: string
  name: string
  source: 'upload' | 'cli' | 'api'
  importedAt: string
  status: 'imported' | 'notes_supplemented' | 'summary_updated'
}

interface Entry {
  id: string
  settlementId: string
  tradeDate: string
  exDividendDate: string | null
  securityCode: string
  securityName: string
  amount: number
  note: string
  taxRate: number | null
  taxRateNote: string | null
  status: 'normal' | 'pending_review' | 'reviewed' | 'corrected'
  reviewedBy: string | null
  reviewedAt: string | null
  correctionReason: string | null
}

interface Summary {
  id: string
  entryId: string
  reason: string
  missingMaterials: string[]
  nextStep: string
  responsibleRole: 'fund_accountant' | 'risk_control'
  generatedAt: string
}

interface AuditLog {
  id: string
  settlementId: string
  entryId: string | null
  action: 'import' | 'supplement_note' | 'manual_correction' | 'rerun' | 'review'
  operator: string
  detail: string
  command: string | null
  createdAt: string
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function mapKeys<T>(obj: any): T {
  if (Array.isArray(obj)) return obj.map(mapKeys) as T
  if (obj !== null && typeof obj === 'object') {
    const result: any = {}
    for (const key of Object.keys(obj)) {
      result[toCamelCase(key)] = mapKeys(obj[key])
    }
    return result as T
  }
  return obj as T
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

async function api<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API Error: ${res.status}`)
  }
  const data = await res.json()
  return mapKeys<ApiResponse<T>>(data)
}

interface AppState {
  settlements: Settlement[]
  entries: Entry[]
  summaries: Summary[]
  auditLogs: AuditLog[]
  currentSettlementId: string | null
  sidebarCollapsed: boolean
  loading: boolean

  fetchSettlements: () => Promise<void>
  fetchEntries: (status?: string) => Promise<void>
  fetchSummaries: (settlementId?: string) => Promise<void>
  fetchAuditLogs: (settlementId?: string) => Promise<void>
  importSettlement: (data: { name: string; source: string; entries: any[] }) => Promise<void>
  supplementNote: (entryId: string, data: { taxRate: number; taxRateNote: string; operator: string }) => Promise<void>
  manualCorrect: (entryId: string, data: { amount?: number; note?: string; correctionReason: string }) => Promise<void>
  reviewEntry: (entryId: string, data: { reviewedBy: string }) => Promise<void>
  refreshSummaries: () => Promise<void>
  rerunSettlement: (settlementId: string) => Promise<void>
  fetchCommand: (logId: string) => Promise<string>
  setCurrentSettlementId: (id: string | null) => void
  toggleSidebar: () => void
}

export const useStore = create<AppState>((set, get) => ({
  settlements: [],
  entries: [],
  summaries: [],
  auditLogs: [],
  currentSettlementId: null,
  sidebarCollapsed: false,
  loading: false,

  fetchSettlements: async () => {
    set({ loading: true })
    try {
      const response = await api<Settlement[]>('/api/settlements')
      set({ settlements: response.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchEntries: async (status?: string) => {
    set({ loading: true })
    try {
      const params = status ? `?status=${status}` : ''
      const response = await api<Entry[]>(`/api/entries${params}`)
      set({ entries: response.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchSummaries: async (settlementId?: string) => {
    set({ loading: true })
    try {
      const params = settlementId ? `?settlement_id=${settlementId}` : ''
      const response = await api<Summary[]>(`/api/summaries${params}`)
      set({ summaries: response.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchAuditLogs: async (settlementId?: string) => {
    set({ loading: true })
    try {
      const params = settlementId ? `?settlement_id=${settlementId}` : ''
      const response = await api<AuditLog[]>(`/api/audit-logs${params}`)
      set({ auditLogs: response.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  importSettlement: async (data) => {
    set({ loading: true })
    try {
      await api('/api/settlements', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchSettlements()
      await get().fetchEntries()
      set({ loading: false })
    } catch {
      set({ loading: false })
    }
  },

  supplementNote: async (entryId, data) => {
    set({ loading: true })
    try {
      await api(`/api/entries/${entryId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          tax_rate: data.taxRate,
          tax_rate_note: data.taxRateNote,
          operator: data.operator,
        }),
      })
      await get().fetchEntries()
      set({ loading: false })
    } catch {
      set({ loading: false })
    }
  },

  manualCorrect: async (entryId, data) => {
    set({ loading: true })
    try {
      await api(`/api/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount: data.amount,
          note: data.note,
          correction_reason: data.correctionReason,
        }),
      })
      await get().fetchEntries()
      set({ loading: false })
    } catch {
      set({ loading: false })
    }
  },

  reviewEntry: async (entryId, data) => {
    set({ loading: true })
    try {
      await api(`/api/entries/${entryId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewed_by: data.reviewedBy }),
      })
      await get().fetchEntries()
      set({ loading: false })
    } catch {
      set({ loading: false })
    }
  },

  refreshSummaries: async () => {
    set({ loading: true })
    try {
      await api('/api/summaries/refresh', { method: 'POST' })
      await get().fetchSummaries()
      set({ loading: false })
    } catch {
      set({ loading: false })
    }
  },

  rerunSettlement: async (settlementId) => {
    set({ loading: true })
    try {
      await api(`/api/settlements/${settlementId}/rerun`, { method: 'POST' })
      await get().fetchEntries()
      await get().fetchAuditLogs(settlementId)
      set({ loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchCommand: async (logId) => {
    const response = await api<{ command: string }>(`/api/audit-logs/${logId}/command`)
    return response.data.command
  },

  setCurrentSettlementId: (id) => set({ currentSettlementId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

export type { Settlement, Entry, Summary, AuditLog }

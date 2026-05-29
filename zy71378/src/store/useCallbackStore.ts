import { create } from 'zustand'

export interface CallbackRecord {
  id: string
  webhook_id: string
  timestamp: string
  signature_header: string
  signature_status: 'valid' | 'expired' | 'invalid' | 'pending'
  retry_count: number
  order_id: string
  order_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
  previous_status: string | null
  processing_result: 'success' | 'failed' | 'duplicate' | 'pending'
  raw_payload: string
  confirm_status: 'confirmed' | 'pending' | 'rejected'
  confirm_note: string | null
  created_at: string
  updated_at: string
}

export interface ReplayTask {
  id: string
  callback_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  idempotency_key: string
  idempotency_check: 'pass' | 'fail' | 'skip'
  result: string | null
  status_before: string | null
  status_after: string | null
  executed_at: string | null
  created_at: string
}

export interface AuditReport {
  total_callbacks: number
  signature_valid: number
  signature_expired: number
  signature_invalid: number
  duplicates: number
  status_regressions: number
  pending_confirmations: number
  replay_success: number
  replay_failed: number
  generated_at: string
}

interface FilterState {
  signature_status: string
  order_status: string
  processing_result: string
  confirm_status: string
  retry_min: string
  retry_max: string
  from: string
  to: string
}

const defaultFilters: FilterState = {
  signature_status: '',
  order_status: '',
  processing_result: '',
  confirm_status: '',
  retry_min: '',
  retry_max: '',
  from: '',
  to: '',
}

function buildQueryParams(filters: FilterState): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  return params.toString()
}

interface CallbackStore {
  filters: FilterState
  setFilter: (key: keyof FilterState, value: string) => void
  resetFilters: () => void

  callbacks: CallbackRecord[]
  callbacksLoading: boolean
  callbacksTotal: number
  callbacksPage: number
  fetchCallbacks: (page?: number) => Promise<void>

  statsOverview: AuditReport | null
  statsLoading: boolean
  fetchStatsOverview: () => Promise<void>

  retryDistribution: { retry_count: number; count: number }[]
  fetchRetryDistribution: () => Promise<void>

  statusDistribution: { status: string; count: number }[]
  fetchStatusDistribution: () => Promise<void>

  trendData: { date: string; total: number; anomaly: number }[]
  fetchTrend: () => Promise<void>

  replayTasks: ReplayTask[]
  replayLoading: boolean
  fetchReplayTasks: () => Promise<void>
  createReplayTasks: (callbackIds: string[]) => Promise<void>
  executeReplayTask: (taskId: string) => Promise<void>

  auditReport: AuditReport | null
  fetchAuditReport: () => Promise<void>
  updateAnnotation: (id: string, note: string) => Promise<void>

  selectedCallbackIds: string[]
  toggleSelectCallback: (id: string) => void
  selectAllCallbacks: () => void
  clearSelection: () => void

  importCallbacks: (records: Record<string, unknown>[]) => Promise<void>
  updateConfirmStatus: (id: string, status: string, note?: string) => Promise<void>

  exportData: (format: 'csv' | 'json') => Promise<void>
}

export const useCallbackStore = create<CallbackStore>((set, get) => ({
  filters: { ...defaultFilters },
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  callbacks: [],
  callbacksLoading: false,
  callbacksTotal: 0,
  callbacksPage: 1,
  fetchCallbacks: async (page?: number) => {
    set({ callbacksLoading: true })
    const { filters } = get()
    const currentPage = page ?? get().callbacksPage
    const query = buildQueryParams(filters)
    try {
      const res = await fetch(
        `/api/callbacks?page=${currentPage}&limit=20&${query}`
      )
      const data = await res.json()
      set({
        callbacks: data.data ?? data.callbacks ?? [],
        callbacksTotal: data.total ?? 0,
        callbacksPage: currentPage,
        callbacksLoading: false,
      })
    } catch {
      set({ callbacksLoading: false })
    }
  },

  statsOverview: null,
  statsLoading: false,
  fetchStatsOverview: async () => {
    set({ statsLoading: true })
    const query = buildQueryParams(get().filters)
    try {
      const res = await fetch(`/api/stats/overview?${query}`)
      const data = await res.json()
      set({ statsOverview: data, statsLoading: false })
    } catch {
      set({ statsLoading: false })
    }
  },

  retryDistribution: [],
  fetchRetryDistribution: async () => {
    const query = buildQueryParams(get().filters)
    try {
      const res = await fetch(`/api/stats/retry-distribution?${query}`)
      const data = await res.json()
      set({ retryDistribution: data.data ?? data ?? [] })
    } catch {
      /* ignore */
    }
  },

  statusDistribution: [],
  fetchStatusDistribution: async () => {
    const query = buildQueryParams(get().filters)
    try {
      const res = await fetch(`/api/stats/status-distribution?${query}`)
      const data = await res.json()
      set({ statusDistribution: data.data ?? data ?? [] })
    } catch {
      /* ignore */
    }
  },

  trendData: [],
  fetchTrend: async () => {
    const query = buildQueryParams(get().filters)
    try {
      const res = await fetch(`/api/stats/trend?${query}`)
      const data = await res.json()
      set({ trendData: data.data ?? data ?? [] })
    } catch {
      /* ignore */
    }
  },

  replayTasks: [],
  replayLoading: false,
  fetchReplayTasks: async () => {
    set({ replayLoading: true })
    try {
      const res = await fetch('/api/replay-tasks')
      const data = await res.json()
      set({ replayTasks: data.data ?? data ?? [], replayLoading: false })
    } catch {
      set({ replayLoading: false })
    }
  },
  createReplayTasks: async (callbackIds: string[]) => {
    await fetch('/api/replay-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_ids: callbackIds }),
    })
    get().fetchReplayTasks()
  },
  executeReplayTask: async (taskId: string) => {
    await fetch(`/api/replay-tasks/${taskId}/execute`, { method: 'POST' })
    get().fetchReplayTasks()
  },

  auditReport: null,
  fetchAuditReport: async () => {
    const query = buildQueryParams(get().filters)
    try {
      const res = await fetch(`/api/reports/audit?${query}`)
      const data = await res.json()
      set({ auditReport: data })
    } catch {
      /* ignore */
    }
  },
  updateAnnotation: async (id: string, note: string) => {
    await fetch(`/api/reports/annotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    get().fetchAuditReport()
  },

  selectedCallbackIds: [],
  toggleSelectCallback: (id: string) =>
    set((state) => {
      const exists = state.selectedCallbackIds.includes(id)
      return {
        selectedCallbackIds: exists
          ? state.selectedCallbackIds.filter((i) => i !== id)
          : [...state.selectedCallbackIds, id],
      }
    }),
  selectAllCallbacks: () =>
    set((state) => ({
      selectedCallbackIds: state.callbacks.map((c) => c.id),
    })),
  clearSelection: () => set({ selectedCallbackIds: [] }),

  importCallbacks: async (records: Record<string, unknown>[]) => {
    await fetch('/api/callbacks/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    })
    get().fetchCallbacks()
  },

  updateConfirmStatus: async (id: string, status: string, note?: string) => {
    await fetch(`/api/callbacks/${id}/confirm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_status: status, confirm_note: note }),
    })
    get().fetchCallbacks()
  },

  exportData: async (format: 'csv' | 'json') => {
    const query = buildQueryParams(get().filters)
    const res = await fetch(`/api/reports/export?format=${format}&${query}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-report.${format}`
    a.click()
    URL.revokeObjectURL(url)
  },
}))

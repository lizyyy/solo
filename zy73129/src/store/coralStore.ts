import { create } from 'zustand'

interface CoralState {
  currentRunId: string | null
  currentRun: any | null
  runs: any[]
  records: any[]
  anomalies: any[]
  snapshots: any[]
  mismatchRecords: any[]
  loading: boolean
  error: string | null

  fetchRuns: () => Promise<void>
  selectRun: (runId: string) => Promise<void>
  fetchRecords: () => Promise<void>
  fetchAnomalies: (extraFilters?: Record<string, string>) => Promise<void>
  fetchSnapshots: () => Promise<void>
  fetchMismatchRecords: () => Promise<void>
  executeRun: (parameters: Record<string, any>) => Promise<void>
  addRecord: (record: any) => Promise<void>
  addAnnotation: (recordId: string, annotation: any) => Promise<void>
  updateAnomalyStatus: (id: string, status: string) => Promise<void>
  persistCoordinateCorrection: (id: string, target: 'detail' | 'file' | 'both') => Promise<void>
  exportReport: (options: any) => Promise<any>
  fetchParameterDiff: (fromId: string, toId: string) => Promise<any>
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '请求失败')
  return json.data
}

export const useCoralStore = create<CoralState>((set, get) => ({
  currentRunId: null,
  currentRun: null,
  runs: [],
  records: [],
  anomalies: [],
  snapshots: [],
  mismatchRecords: [],
  loading: false,
  error: null,

  fetchRuns: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch('/api/runs')
      set({ runs: data, loading: false })
      if (!get().currentRunId && data.length > 0) {
        await get().selectRun(data[0].id)
      }
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  selectRun: async (runId: string) => {
    set({ loading: true, error: null, currentRunId: runId })
    try {
      const [runDetail, _anomalies] = await Promise.all([
        apiFetch(`/api/runs/${runId}`),
        apiFetch(`/api/anomalies?run_id=${runId}`),
      ])
      set({ currentRun: runDetail, anomalies: _anomalies, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchRecords: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch('/api/records')
      set({ records: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchAnomalies: async (extraFilters?: Record<string, string>) => {
    set({ loading: true, error: null })
    try {
      const { currentRunId } = get()
      const filters: Record<string, string> = {}
      if (currentRunId) filters.run_id = currentRunId
      if (extraFilters) Object.assign(filters, extraFilters)
      const params = new URLSearchParams(filters)
      const url = `/api/anomalies${params.toString() ? `?${params.toString()}` : ''}`
      const data = await apiFetch(url)
      set({ anomalies: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchSnapshots: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch('/api/parameters/snapshots')
      set({ snapshots: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchMismatchRecords: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch('/api/records/mismatch')
      set({ mismatchRecords: data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  executeRun: async (parameters: Record<string, any>) => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch('/api/runs', {
        method: 'POST',
        body: JSON.stringify({ parameters }),
      })
      const newRunId = data.id
      await get().fetchRuns()
      await get().selectRun(newRunId)
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  addRecord: async (record: any) => {
    set({ loading: true, error: null })
    try {
      await apiFetch('/api/records', {
        method: 'POST',
        body: JSON.stringify(record),
      })
      await get().fetchRecords()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  addAnnotation: async (recordId: string, annotation: any) => {
    set({ loading: true, error: null })
    try {
      await apiFetch(`/api/records/${recordId}/annotations`, {
        method: 'POST',
        body: JSON.stringify(annotation),
      })
      await get().fetchRecords()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  updateAnomalyStatus: async (id: string, status: string) => {
    set({ loading: true, error: null })
    try {
      await apiFetch(`/api/anomalies/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await get().fetchAnomalies()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  persistCoordinateCorrection: async (id: string, target: 'detail' | 'file' | 'both') => {
    set({ loading: true, error: null })
    try {
      await apiFetch(`/api/anomalies/${id}/persist`, {
        method: 'PATCH',
        body: JSON.stringify({ target }),
      })
      await get().fetchAnomalies()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  exportReport: async (options: any) => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch('/api/export', {
        method: 'POST',
        body: JSON.stringify(options),
      })
      set({ loading: false })
      return data
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },

  fetchParameterDiff: async (fromId: string, toId: string) => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch(`/api/parameters/diff?from=${fromId}&to=${toId}`)
      set({ loading: false })
      return data
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },
}))

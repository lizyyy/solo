import { create } from 'zustand'
import type { Work, Student, Batch, Glaze, GlazeConflict, QueueEntry, Conflict, RescheduleLog, FiringReport } from '@/types'

interface AppState {
  works: Work[]
  students: Student[]
  batches: Batch[]
  glazes: Glaze[]
  glazeConflicts: GlazeConflict[]
  rescheduleLogs: RescheduleLog[]
  reports: FiringReport[]
  loading: boolean
  error: string | null

  fetchWorks: () => Promise<void>
  fetchStudents: () => Promise<void>
  fetchBatches: () => Promise<void>
  fetchGlazes: () => Promise<void>
  fetchGlazeConflicts: () => Promise<void>
  fetchRescheduleLogs: () => Promise<void>
  fetchReports: () => Promise<void>
  fetchAll: () => Promise<void>

  createWork: (data: Partial<Work> & { glaze_ids: string[] }) => Promise<Work | null>
  updateWork: (id: string, data: Partial<Work> & { glaze_ids?: string[] }) => Promise<Work | null>
  deleteWork: (id: string) => Promise<boolean>

  createStudent: (data: Partial<Student>) => Promise<Student | null>
  updateStudent: (id: string, data: Partial<Student>) => Promise<Student | null>
  deleteStudent: (id: string) => Promise<boolean>

  createBatch: (data: Partial<Batch>) => Promise<Batch | null>
  updateBatch: (id: string, data: Partial<Batch>) => Promise<Batch | null>
  lockBatch: (id: string) => Promise<Batch | null>
  unlockBatch: (id: string) => Promise<Batch | null>
  fireBatch: (id: string) => Promise<Batch | null>
  completeBatch: (id: string) => Promise<Batch | null>

  createGlaze: (data: Partial<Glaze>) => Promise<Glaze | null>
  updateGlaze: (id: string, data: Partial<Glaze>) => Promise<Glaze | null>
  deleteGlaze: (id: string) => Promise<boolean>

  createGlazeConflict: (data: { glaze_a_id: string; glaze_b_id: string; reason: string }) => Promise<GlazeConflict | null>
  deleteGlazeConflict: (id: string) => Promise<boolean>

  enqueue: (workId: string, batchId: string, position?: number) => Promise<{ entry: QueueEntry | null; conflicts: Conflict[] }>
  dequeue: (entryId: string) => Promise<boolean>
  reschedule: (data: { work_id: string; from_batch_id: string; to_batch_id?: string; reason: string; operated_by: string }) => Promise<boolean>

  generateReport: (batchId: string) => Promise<FiringReport | null>
  exportReport: (reportId: string, format: 'json' | 'csv') => Promise<void>
}

const api = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...options,
  })
  const body = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return body.data as T
}

export const useStore = create<AppState>((set, get) => ({
  works: [],
  students: [],
  batches: [],
  glazes: [],
  glazeConflicts: [],
  rescheduleLogs: [],
  reports: [],
  loading: false,
  error: null,

  fetchWorks: async () => {
    const data = await api<any[]>('/api/works')
    set({ works: data.map((w: any) => ({
      ...w,
      glaze_ids: typeof w.glaze_ids === 'string' ? w.glaze_ids.split(',').filter(Boolean) : (w.glaze_ids ?? []),
      glaze_names: typeof w.glaze_names === 'string' ? w.glaze_names.split(',').filter(Boolean) : (w.glaze_names ?? []),
    })) })
  },
  fetchStudents: async () => {
    const data = await api<Student[]>('/api/students')
    set({ students: data })
  },
  fetchBatches: async () => {
    const data = await api<Batch[]>('/api/batches')
    set({ batches: data })
  },
  fetchGlazes: async () => {
    const data = await api<Glaze[]>('/api/glazes')
    set({ glazes: data })
  },
  fetchGlazeConflicts: async () => {
    const data = await api<GlazeConflict[]>('/api/glaze-conflicts')
    set({ glazeConflicts: data })
  },
  fetchRescheduleLogs: async () => {
    const data = await api<RescheduleLog[]>('/api/reschedule-logs')
    set({ rescheduleLogs: data })
  },
  fetchReports: async () => {
    const data = await api<FiringReport[]>('/api/reports')
    set({ reports: data })
  },
  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      await Promise.all([
        get().fetchWorks(),
        get().fetchStudents(),
        get().fetchBatches(),
        get().fetchGlazes(),
        get().fetchGlazeConflicts(),
        get().fetchRescheduleLogs(),
        get().fetchReports(),
      ])
    } catch (e: any) {
      set({ error: e.message })
    } finally {
      set({ loading: false })
    }
  },

  createWork: async (data) => {
    try {
      const work = await api<Work>('/api/works', { method: 'POST', body: JSON.stringify(data) })
      await get().fetchWorks()
      return work
    } catch { return null }
  },
  updateWork: async (id, data) => {
    try {
      const work = await api<Work>(`/api/works/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      await get().fetchWorks()
      return work
    } catch { return null }
  },
  deleteWork: async (id) => {
    try {
      await api(`/api/works/${id}`, { method: 'DELETE' })
      await get().fetchWorks()
      return true
    } catch { return false }
  },

  createStudent: async (data) => {
    try {
      const student = await api<Student>('/api/students', { method: 'POST', body: JSON.stringify(data) })
      await get().fetchStudents()
      return student
    } catch { return null }
  },
  updateStudent: async (id, data) => {
    try {
      const student = await api<Student>(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      await get().fetchStudents()
      return student
    } catch { return null }
  },
  deleteStudent: async (id) => {
    try {
      await api(`/api/students/${id}`, { method: 'DELETE' })
      await get().fetchStudents()
      return true
    } catch { return false }
  },

  createBatch: async (data) => {
    try {
      const batch = await api<Batch>('/api/batches', { method: 'POST', body: JSON.stringify(data) })
      await get().fetchBatches()
      return batch
    } catch { return null }
  },
  updateBatch: async (id, data) => {
    try {
      const batch = await api<Batch>(`/api/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      await get().fetchBatches()
      return batch
    } catch { return null }
  },
  lockBatch: async (id) => {
    try {
      const batch = await api<Batch>(`/api/batches/${id}/lock`, { method: 'POST' })
      await get().fetchBatches()
      return batch
    } catch { return null }
  },
  unlockBatch: async (id) => {
    try {
      const batch = await api<Batch>(`/api/batches/${id}/unlock`, { method: 'POST' })
      await get().fetchBatches()
      return batch
    } catch { return null }
  },
  fireBatch: async (id) => {
    try {
      const batch = await api<Batch>(`/api/batches/${id}/fire`, { method: 'POST' })
      await get().fetchBatches()
      await get().fetchWorks()
      return batch
    } catch { return null }
  },
  completeBatch: async (id) => {
    try {
      const batch = await api<Batch>(`/api/batches/${id}/complete`, { method: 'POST' })
      await get().fetchBatches()
      await get().fetchWorks()
      return batch
    } catch { return null }
  },

  createGlaze: async (data) => {
    try {
      const glaze = await api<Glaze>('/api/glazes', { method: 'POST', body: JSON.stringify(data) })
      await get().fetchGlazes()
      return glaze
    } catch { return null }
  },
  updateGlaze: async (id, data) => {
    try {
      const glaze = await api<Glaze>(`/api/glazes/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      await get().fetchGlazes()
      return glaze
    } catch { return null }
  },
  deleteGlaze: async (id) => {
    try {
      await api(`/api/glazes/${id}`, { method: 'DELETE' })
      await get().fetchGlazes()
      return true
    } catch { return false }
  },

  createGlazeConflict: async (data) => {
    try {
      const conflict = await api<GlazeConflict>('/api/glaze-conflicts', { method: 'POST', body: JSON.stringify(data) })
      await get().fetchGlazeConflicts()
      return conflict
    } catch { return null }
  },
  deleteGlazeConflict: async (id) => {
    try {
      await api(`/api/glaze-conflicts/${id}`, { method: 'DELETE' })
      await get().fetchGlazeConflicts()
      return true
    } catch { return false }
  },

  enqueue: async (workId, batchId, position) => {
    try {
      const result = await api<{ entry: QueueEntry; conflicts: Conflict[] }>('/api/queue/enqueue', {
        method: 'POST',
        body: JSON.stringify({ work_id: workId, batch_id: batchId, position }),
      })
      await Promise.all([get().fetchWorks(), get().fetchBatches()])
      return result
    } catch {
      return { entry: null, conflicts: [] }
    }
  },
  dequeue: async (entryId) => {
    try {
      await api(`/api/queue/${entryId}`, { method: 'DELETE' })
      await Promise.all([get().fetchWorks(), get().fetchBatches()])
      return true
    } catch { return false }
  },
  reschedule: async (data) => {
    try {
      await api('/api/queue/reschedule', { method: 'POST', body: JSON.stringify(data) })
      await Promise.all([get().fetchWorks(), get().fetchBatches(), get().fetchRescheduleLogs()])
      return true
    } catch { return false }
  },

  generateReport: async (batchId) => {
    try {
      const report = await api<FiringReport>(`/api/batches/${batchId}/generate-report`, { method: 'POST' })
      await get().fetchReports()
      return report
    } catch { return null }
  },
  exportReport: async (reportId, format) => {
    window.open(`/api/reports/${reportId}/export?format=${format}`, '_blank')
  },
}))

import { create } from 'zustand'
import type {
  CalibrationRecord,
  RecordDetail,
  OperationLog,
  FieldTeamNote,
} from '@/types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface CalibrationState {
  records: CalibrationRecord[]
  currentRecord: RecordDetail | null
  operationLogs: OperationLog[]
  fieldTeamNote: FieldTeamNote | null
  statusFilter: string
  loading: boolean
  error: string | null

  setStatusFilter: (filter: string) => void
  fetchRecords: () => Promise<void>
  fetchRecordDetail: (id: string) => Promise<void>
  importData: (jsonData: string) => Promise<boolean>
  supplementPhoto: (recordId: string, photoIds: string[], operator: string) => Promise<boolean>
  manualCorrect: (
    recordId: string,
    entryId: string,
    correction: Record<string, number>,
    operator: string,
    reason: string,
  ) => Promise<boolean>
  rerunCalibration: (recordId: string, operator: string) => Promise<boolean>
  fetchLogs: (recordId: string) => Promise<void>
  fetchNote: (recordId: string) => Promise<void>
}

function toCamelCase<T>(obj: Record<string, any>): T {
  const result: Record<string, any> = {}
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    const val = obj[key]
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      result[camelKey] = toCamelCase(val)
    } else {
      result[camelKey] = val
    }
  }
  return result as T
}

async function apiCall<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    return await res.json()
  } catch {
    return { success: false, error: '网络请求失败' }
  }
}

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  records: [],
  currentRecord: null,
  operationLogs: [],
  fieldTeamNote: null,
  statusFilter: '',
  loading: false,
  error: null,

  setStatusFilter: (filter) => set({ statusFilter: filter }),

  fetchRecords: async () => {
    set({ loading: true, error: null })
    const res = await apiCall<any[]>('/api/records')
    if (res.success && res.data) {
      const records = res.data.map((r: any) => toCamelCase<CalibrationRecord>({
        ...r,
        photo_count: r.photo_count ?? 0,
      }))
      set({ records, loading: false })
    } else {
      set({ error: res.error || '获取记录失败', loading: false })
    }
  },

  fetchRecordDetail: async (id) => {
    set({ loading: true, error: null, currentRecord: null })
    const res = await apiCall<any>(`/api/records/${id}`)
    if (res.success && res.data) {
      const raw = res.data
      const photos = raw.photos || []
      const coordinates = (raw.coordinates || []).map((c: any) => toCamelCase<any>({
        ...c,
        manual_correction: c.manual_correction,
      }))
      const record = toCamelCase<RecordDetail>({
        ...raw,
        photo_count: photos.length,
        photo_ids: photos.map((p: any) => p.photo_id),
        photo_supplemented_at: photos.length > 0 ? photos[photos.length - 1].supplemented_at : null,
        photo_supplemented_by: photos.length > 0 ? photos[photos.length - 1].supplemented_by : null,
      })
      set({
        currentRecord: { ...record, coordinates } as RecordDetail,
        operationLogs: (raw.logs || []).map((l: any) => toCamelCase<OperationLog>(l)),
        fieldTeamNote: raw.note ? toCamelCase<FieldTeamNote>(raw.note) : null,
        loading: false,
      })
    } else {
      set({ error: res.error || '获取详情失败', loading: false })
    }
  },

  importData: async (jsonData) => {
    set({ loading: true, error: null })
    const res = await apiCall<any>('/api/records/import', {
      method: 'POST',
      body: jsonData,
    })
    if (res.success) {
      set({ loading: false })
      return true
    }
    set({ error: res.error || '导入失败', loading: false })
    return false
  },

  supplementPhoto: async (recordId, photoIds, operator) => {
    set({ loading: true, error: null })
    const res = await apiCall<void>(`/api/records/${recordId}/photo`, {
      method: 'PATCH',
      body: JSON.stringify({ photoIds, operator }),
    })
    if (res.success) {
      set({ loading: false })
      return true
    }
    set({ error: res.error || '补录失败', loading: false })
    return false
  },

  manualCorrect: async (recordId, entryId, correction, operator, reason) => {
    set({ loading: true, error: null })
    const res = await apiCall<void>(`/api/records/${recordId}/correct`, {
      method: 'POST',
      body: JSON.stringify({ entryId, correction, operator, reason }),
    })
    if (res.success) {
      set({ loading: false })
      return true
    }
    set({ error: res.error || '修正失败', loading: false })
    return false
  },

  rerunCalibration: async (recordId, operator) => {
    set({ loading: true, error: null })
    const res = await apiCall<void>(`/api/records/${recordId}/rerun`, {
      method: 'POST',
      body: JSON.stringify({ operator }),
    })
    if (res.success) {
      set({ loading: false })
      return true
    }
    set({ error: res.error || '重跑失败', loading: false })
    return false
  },

  fetchLogs: async (recordId) => {
    set({ loading: true, error: null })
    const res = await apiCall<any[]>(`/api/records/${recordId}/logs`)
    if (res.success && res.data) {
      set({ operationLogs: res.data.map((l) => toCamelCase<OperationLog>(l)), loading: false })
    } else {
      set({ error: res.error || '获取日志失败', loading: false })
    }
  },

  fetchNote: async (recordId) => {
    set({ loading: true, error: null })
    const res = await apiCall<any>(`/api/records/${recordId}/note`)
    if (res.success && res.data) {
      set({ fieldTeamNote: toCamelCase<FieldTeamNote>(res.data), loading: false })
    } else {
      set({ fieldTeamNote: null, loading: false })
    }
  },
}))

import axios from 'axios'
import type { ApiResponse, PaginatedResponse, SoundMaterial, AudioTrack, AdScript, MatchRelation, TraceChain, OperationHistory, ExportRecord, MaterialFilterParams, ConsistencyCheckResult } from '@/types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  config.headers['X-Request-ID'] = requestId
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

const extractData = <T>(response: { data: ApiResponse<T> }) => response.data.data

export const materialApi = {
  getSoundMaterials: (params?: MaterialFilterParams & { page?: number; page_size?: number }) =>
    api.get<ApiResponse<PaginatedResponse<SoundMaterial>>>('/sound-materials', { params }).then(extractData),

  getSoundMaterial: (id: number) =>
    api.get<ApiResponse<SoundMaterial>>(`/sound-materials/${id}`).then(extractData),

  getMaterialTrace: (id: number) =>
    api.get<ApiResponse<TraceChain>>(`/sound-materials/${id}/trace`).then(extractData),

  getAudioTracks: (params?: { track_no?: string; search_keyword?: string; page?: number; page_size?: number }) =>
    api.get<ApiResponse<PaginatedResponse<AudioTrack>>>('/audio-tracks', { params }).then(extractData),

  getAudioTrack: (id: number) =>
    api.get<ApiResponse<AudioTrack>>(`/audio-tracks/${id}`).then(extractData),

  getAdScripts: (params?: { script_no?: string; track_id?: number; page?: number; page_size?: number }) =>
    api.get<ApiResponse<PaginatedResponse<AdScript>>>('/ad-scripts', { params }).then(extractData),

  getAdScript: (id: number) =>
    api.get<ApiResponse<AdScript>>(`/ad-scripts/${id}`).then(extractData),

  getMatches: (params?: { status?: string; material_id?: number; page?: number; page_size?: number }) =>
    api.get<ApiResponse<PaginatedResponse<MatchRelation>>>('/matches', { params }).then(extractData),

  updateMatch: (id: number, data: { status: string; remark?: string }) =>
    api.put<ApiResponse<MatchRelation>>(`/matches/${id}`, data).then(extractData),

  autoMatch: (params?: { min_confidence?: number }) =>
    api.post<ApiResponse<{ matched_count: number; total_count: number }>>('/matches/auto-match', params).then(extractData),

  batchConfirm: (ids: number[], remark?: string) =>
    api.post<ApiResponse<{ success_count: number }>>('/matches/batch-confirm', { ids, remark }).then(extractData),

  batchReject: (ids: number[], remark?: string) =>
    api.post<ApiResponse<{ success_count: number }>>('/matches/batch-reject', { ids, remark }).then(extractData),
}

export const importApi = {
  uploadAudioTracks: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<any>>('/audio-tracks/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(extractData)
  },

  uploadAdScripts: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<any>>('/ad-scripts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(extractData)
  },

  uploadSoundMaterials: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<any>>('/sound-materials/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(extractData)
  },

  getImportBatches: (params?: { import_type?: string; page?: number; page_size?: number }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/import/batches', { params }).then(extractData),

  getImportBatch: (id: number) =>
    api.get<ApiResponse<any>>(`/import/batches/${id}`).then(extractData),
}

export const exportApi = {
  preview: (params: MaterialFilterParams) =>
    api.post<ApiResponse<{ count: number; preview_items: SoundMaterial[]; filter_hash: string }>>('/export/preview', params).then(extractData),

  execute: (params: MaterialFilterParams & { filename?: string }) =>
    api.post<ApiResponse<ExportRecord>>('/export', params).then(extractData),

  getRecords: (params?: { page?: number; page_size?: number }) =>
    api.get<ApiResponse<PaginatedResponse<ExportRecord>>>('/export/records', { params }).then(extractData),

  download: (id: number) =>
    api.get(`/export/records/${id}/download`, { responseType: 'blob' }),

  checkConsistency: (params: MaterialFilterParams & { screen_count: number }) =>
    api.get<ApiResponse<ConsistencyCheckResult>>(`/export/records/${0}/verify`, { params }).then(extractData),
}

export const historyApi = {
  getHistory: (params?: { operation_type?: string; target_type?: string; target_id?: number; operator?: string; page?: number; page_size?: number }) =>
    api.get<ApiResponse<PaginatedResponse<OperationHistory>>>('/history', { params }).then(extractData),

  getHistoryDetail: (id: number) =>
    api.get<ApiResponse<OperationHistory>>(`/history/${id}`).then(extractData),

  getByTraceId: (traceId: string) =>
    api.get<ApiResponse<OperationHistory[]>>(`/history/trace/${traceId}`).then(extractData),
}

export default api

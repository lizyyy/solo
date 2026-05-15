import axios from 'axios'
import type {
  Preference, ChangeHistory, SendInterception, AnomalyQueue,
  StatsSummary, ValidationResult, PreferenceCreate, ExportRequest
} from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

export const preferenceApi = {
  create: (data: PreferenceCreate) => 
    api.post<Preference>('/preferences', data),
  
  getAll: (params?: {
    user_id?: string
    channel?: string
    business_scene?: string
    status?: string
    skip?: number
    limit?: number
  }) => 
    api.get<Preference[]>('/preferences', { params }),
  
  getById: (id: number) => 
    api.get<Preference>(`/preferences/${id}`),
  
  merge: (data: { user_id: string; channel: string; business_scene: string }) => 
    api.post<Preference>('/preferences/merge', data),
  
  getHistory: (params?: {
    user_id?: string
    preference_id?: number
    skip?: number
    limit?: number
  }) => 
    api.get<ChangeHistory[]>('/preferences/history', { params }),
  
  validate: (data: { user_id: string; channel: string; business_scene: string }) => 
    api.post<ValidationResult>('/preferences/validate', data),
  
  getInterceptions: (params?: {
    user_id?: string
    status?: string
    skip?: number
    limit?: number
  }) => 
    api.get<SendInterception[]>('/preferences/interceptions', { params }),
  
  getInterceptionReport: (params?: { start_date?: string; end_date?: string }) => 
    api.get('/preferences/interceptions/report', { params }),
  
  getAnomalies: (params?: {
    status?: string
    user_id?: string
    skip?: number
    limit?: number
  }) => 
    api.get<AnomalyQueue[]>('/preferences/anomalies', { params }),
  
  advanceAnomaly: (data: {
    anomaly_id: number
    target_status: string
    resolution_note?: string
    resolver?: string
  }) => 
    api.post<AnomalyQueue>('/preferences/anomalies/advance', data),
  
  getStats: () => 
    api.get<StatsSummary>('/preferences/stats/summary'),
  
  exportPreferences: (data: ExportRequest) => 
    api.post('/preferences/export/preferences', data, { responseType: 'blob' }),
  
  exportHistory: (data: ExportRequest) => 
    api.post('/preferences/export/history', data, { responseType: 'blob' }),
  
  exportInterceptions: (data: ExportRequest) => 
    api.post('/preferences/export/interceptions', data, { responseType: 'blob' }),
  
  exportAnomalies: (data: ExportRequest) => 
    api.post('/preferences/export/anomalies', data, { responseType: 'blob' })
}

export default api

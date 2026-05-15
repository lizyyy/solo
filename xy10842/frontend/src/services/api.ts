import axios from 'axios'
import { ModelVersion, Evaluation, Metric, FailureSample, Note, ReleaseSuggestion } from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const modelVersions = {
  getAll: (): Promise<ModelVersion[]> => api.get('/model-versions/').then(res => res.data),
  create: (data: Omit<ModelVersion, 'id' | 'created_at' | 'updated_at'>): Promise<ModelVersion> => 
    api.post('/model-versions/', data).then(res => res.data),
}

export const evaluations = {
  getAll: (params?: { model_version_id?: number; status?: string }): Promise<Evaluation[]> =>
    api.get('/evaluations/', { params }).then(res => res.data),
  getById: (id: number): Promise<Evaluation> =>
    api.get(`/evaluations/${id}`).then(res => res.data),
  create: (data: Omit<Evaluation, 'id' | 'started_at' | 'completed_at'>): Promise<Evaluation> =>
    api.post('/evaluations/', data).then(res => res.data),
  updateStatus: (id: number, status: string): Promise<Evaluation> =>
    api.patch(`/evaluations/${id}/status`, { status }).then(res => res.data),
  getAnomalies: (): Promise<Evaluation[]> =>
    api.get('/anomalies/').then(res => res.data),
  export: (id: number, format: 'json' | 'csv' = 'json'): Promise<any> =>
    api.get(`/evaluations/${id}/export`, { params: { format } }).then(res => res.data),
}

export const metrics = {
  getAll: (params?: { evaluation_id?: number }): Promise<Metric[]> =>
    api.get('/metrics/', { params }).then(res => res.data),
  compare: (evaluation_ids: number[]): Promise<any[]> =>
    api.post('/metrics/compare/', { evaluation_ids }).then(res => res.data),
  getHistory: (metric_name: string): Promise<any[]> =>
    api.get('/metrics/history', { params: { metric_name } }).then(res => res.data),
}

export const failureSamples = {
  getAll: (params?: { evaluation_id?: number; is_resolved?: boolean }): Promise<FailureSample[]> =>
    api.get('/failure-samples/', { params }).then(res => res.data),
  update: (id: number, data: Partial<FailureSample>): Promise<FailureSample> =>
    api.patch(`/failure-samples/${id}`, data).then(res => res.data),
}

export const notes = {
  getAll: (params?: { evaluation_id?: number }): Promise<Note[]> =>
    api.get('/notes/', { params }).then(res => res.data),
  create: (data: Omit<Note, 'id' | 'created_at'>): Promise<Note> =>
    api.post('/notes/', data).then(res => res.data),
}

export const releaseSuggestions = {
  getAll: (params?: { model_version_id?: number }): Promise<ReleaseSuggestion[]> =>
    api.get('/release-suggestions/', { params }).then(res => res.data),
  create: (data: Omit<ReleaseSuggestion, 'id' | 'is_approved' | 'approved_by' | 'approved_at' | 'created_at'>): Promise<ReleaseSuggestion> =>
    api.post('/release-suggestions/', data).then(res => res.data),
}

export default api

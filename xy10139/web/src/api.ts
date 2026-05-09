import axios from 'axios'
import type { AxiosInstance } from 'axios'

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface ValidationSchema {
  id: string
  name: string
  type: string
  fields: any[]
}

export interface ImportJob {
  id: string
  name: string
  type: string
  status: string
  totalRows: number
  successCount: number
  failedCount: number
  skippedCount: number
  createdAt: string
  updatedAt: string
}

export interface RowResult {
  id: string
  jobId: string
  rowIndex: number
  status: 'success' | 'failed' | 'skipped'
  data: Record<string, any>
  errors: ValidationError[]
  retryCount: number
  lastRetriedAt?: string
}

export interface ValidationError {
  field: string
  rule: string
  message: string
  value?: any
}

export interface ImportSummary {
  total: number
  success: number
  failed: number
  failedDetails: ValidationError[]
}

export const schemasApi = {
  list: () => api.get<{ schemas: ValidationSchema[] }>('/schemas')
}

export const jobsApi = {
  list: (limit = 50, offset = 0) => 
    api.get<{ jobs: ImportJob[] }>('/jobs', { params: { limit, offset } }),
  get: (id: string) => 
    api.get<{ job: ImportJob; summary: ImportSummary }>(`/jobs/${id}`),
  getRows: (id: string, status?: 'success' | 'failed') => 
    api.get<{ rows: RowResult[] }>(`/jobs/${id}/rows`, { params: { status } }),
  retry: (jobId: string, rowIds?: string[], overrideData?: Record<string, Record<string, any>>) =>
    api.post<{ job: ImportJob; summary: ImportSummary }>(`/import/${jobId}/retry`, {
      rowIds,
      overrideData
    }),
  createReport: (jobId: string, format: 'csv' | 'json' | 'xlsx' = 'csv') =>
    api.post<{ report: any }>(`/jobs/${jobId}/report`, { format }),
  listReports: (jobId: string) =>
    api.get<{ reports: any[] }>(`/jobs/${jobId}/reports`)
}

export const importApi = {
  upload: (file: File, schemaId: string, format?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('schemaId', schemaId)
    if (format) {
      formData.append('format', format)
    }
    return api.post<{ job: ImportJob; summary: ImportSummary }>('/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

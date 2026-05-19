import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface SchemaVersion {
  id: number
  schema_name: string
  version: string
  fields: Record<string, any>
  created_by?: string
  description?: string
  created_at: string
  is_active: boolean
}

export interface Consumer {
  id: number
  name: string
  team?: string
  email?: string
  subscribed_schema_id?: number
  subscribed_fields?: string[]
  status: string
  created_at: string
  last_sync_at?: string
}

export interface ChangeRequest {
  id: number
  schema_id: number
  request_id: string
  title: string
  change_type?: string
  old_schema: Record<string, any>
  new_schema: Record<string, any>
  status: string
  created_by?: string
  created_at: string
  approved_at?: string
  approved_by?: string
  comments?: string
  compatibility_result?: CompatibilityResult
}

export interface InterceptRecord {
  id: number
  change_request_id: number
  consumer_id: number
  intercept_time: string
  reason: string
  severity: string
  status: string
  resolved_at?: string
  resolved_by?: string
  resolution_note?: string
  failed_sample?: Record<string, any>
}

export interface StatusHistory {
  id: number
  change_request_id: number
  from_status?: string
  to_status: string
  changed_by?: string
  changed_at: string
  comments?: string
}

export interface CompatibilityResult {
  is_compatible: boolean
  breaking_changes: Array<{
    type: string
    field: string
    message: string
    severity: string
  }>
  warnings: Array<{
    type: string
    field: string
    message: string
    severity: string
  }>
  affected_consumers: Array<{
      consumer_id: number
      consumer_name: string
      team?: string
      email?: string
      affected_fields: Array<{
        field: string
        change_type: string
        message: string
      }>
    }>
    recommendations: string[]
  }
  
  export interface DashboardStats {
    total_schemas: number
    total_consumers: number
    total_change_requests: number
    pending_requests: number
    open_intercepts: number
    resolved_intercepts: number
    recent_changes: Array<{
      id: number
      request_id: string
      title: string
      status: string
      created_at: string
    }>
  }
  
  export const schemaApi = {
    getAll: () => api.get<SchemaVersion[]>('/schemas'),
    create: (data: Omit<SchemaVersion, 'id' | 'created_at' | 'is_active'>) => 
      api.post<SchemaVersion>('/schemas', data),
    get: (id: number) => api.get<SchemaVersion>(`/schemas/${id}`),
  }
  
  export const consumerApi = {
    getAll: () => api.get<Consumer[]>('/consumers'),
    create: (data: Omit<Consumer, 'id' | 'created_at' | 'status'>) => 
      api.post<Consumer>('/consumers', data),
  }
  
  export const changeRequestApi = {
    getAll: (params?: { status?: string; schema_id?: number }) => 
      api.get<ChangeRequest[]>('/change-requests', { params }),
    create: (data: {
      schema_id: number
      title: string
      change_type?: string
      old_schema: Record<string, any>
      new_schema: Record<string, any>
      created_by?: string
      comments?: string
    }) => api.post<ChangeRequest>('/change-requests', data),
    get: (id: number) => api.get<ChangeRequest>(`/change-requests/${id}`),
    updateStatus: (id: number, data: { status: string; approved_by?: string; comments?: string }) =>
      api.patch<ChangeRequest>(`/change-requests/${id}/status`, data),
  }
  
  export const interceptRecordApi = {
    getAll: (params?: { status?: string; change_request_id?: number; consumer_id?: number }) =>
      api.get<InterceptRecord[]>('/intercept-records', { params }),
    resolve: (id: number, data: { resolved_by: string; resolution_note: string }) =>
      api.patch<InterceptRecord>(`/intercept-records/${id}/resolve`, data),
  }
  
  export const dashboardApi = {
    getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  }
  
  export const exportApi = {
    impactReport: (changeRequestId: number) => 
      api.post(`/export/impact-report?change_request_id=${changeRequestId}`, null, {
        responseType: 'blob',
      }),
    interceptRecords: (status?: string) =>
      api.post(`/export/intercept-records${status ? `?status=${status}` : ''}`, null, {
        responseType: 'blob',
      }),
  }

  export const statusHistoryApi = {
    getByChangeRequestId: (changeRequestId: number) =>
      api.get<StatusHistory[]>(`/change-requests/${changeRequestId}/status-history`),
  }
  
  export default api
  
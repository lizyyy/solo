const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '请求失败')
  return json.data as T
}

export interface ImportResult {
  imported: number
  mixed: number
  normal: number
  batch: { id: string; fileName: string; totalCount: number; mixedCount: number; createdAt: string }
  records: any[]
}

export async function importRecords(file: File): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  return request<ImportResult>('/records/import', {
    method: 'POST',
    body: formData,
  })
}

export async function fetchRecords(params: {
  status?: string
  sensorId?: string
  page?: number
  pageSize?: number
}): Promise<{ total: number; records: any[] }> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.sensorId) query.set('sensorId', params.sensorId)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  return request(`/records?${query.toString()}`)
}

export async function fetchRecord(id: string): Promise<any> {
  return request(`/records/${id}`)
}

export async function reviewRecord(
  id: string,
  data: {
    credibility: string
    correctedValue?: number
    correctedUnit?: string
    note?: string
    operatorRole: string
  }
): Promise<any> {
  return request(`/records/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function confirmRecord(id: string, operatorRole: string, note?: string): Promise<any> {
  return request(`/records/${id}/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorRole, note }),
  })
}

export async function rollbackRecord(id: string, reason: string, operatorRole: string): Promise<any> {
  return request(`/records/${id}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, operatorRole }),
  })
}

export async function fetchAuditLogs(recordId: string): Promise<any[]> {
  return request(`/records/${recordId}/audit-log`)
}

export async function uploadPhoto(recordId: string, file: File, description?: string): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  if (description) formData.append('description', description)
  return request(`/records/${recordId}/photos`, {
    method: 'POST',
    body: formData,
  })
}

export async function fetchPhotos(recordId: string): Promise<any[]> {
  return request(`/records/${recordId}/photos`)
}

export async function fetchReport(): Promise<any> {
  return request('/report')
}

export function getReportExportUrl(): string {
  return `${BASE}/report/export?format=csv`
}

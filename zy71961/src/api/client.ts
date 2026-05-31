import type {
  Report,
  Conclusion,
  Evaluation,
  ChangeRecord,
  Bundle,
  MaterialRecord,
  AnnotationSample,
  ConsistencyResult,
  GuideSection,
  Model,
} from '@/types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message || `请求失败: ${res.status}`)
  }
  const json = await res.json()
  return json.data as T
}

export async function fetchReports(params?: {
  modelId?: string
  date?: string
  severity?: string
  search?: string
}): Promise<Report[]> {
  const searchParams = new URLSearchParams()
  if (params?.modelId) searchParams.set('modelId', params.modelId)
  if (params?.date) searchParams.set('date', params.date)
  if (params?.severity) searchParams.set('severity', params.severity)
  if (params?.search) searchParams.set('search', params.search)
  const qs = searchParams.toString()
  return request<Report[]>(`/reports${qs ? `?${qs}` : ''}`)
}

export async function fetchReport(id: string): Promise<{
  report: Report
  conclusions: Conclusion[]
  evaluations: Evaluation[]
  changeHistory: ChangeRecord[]
}> {
  return request(`/reports/${id}`)
}

export async function uploadBundle(file: File): Promise<{
  bundle: Bundle
  records: MaterialRecord[]
}> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/bundles', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message || `上传失败: ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

export async function fetchBundles(): Promise<Bundle[]> {
  return request<Bundle[]>('/bundles')
}

export async function confirmBundle(
  id: string,
  modelId: string,
  date: string,
): Promise<Report> {
  return request<Report>(`/bundles/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ modelId, date }),
  })
}

export async function fetchSample(id: string): Promise<{
  sample: AnnotationSample
  linkedRecords: MaterialRecord[]
  linkedSources: any[]
}> {
  return request(`/samples/${id}`)
}

export async function fetchEvaluation(id: string): Promise<{
  evaluation: Evaluation
  linkedRecords: MaterialRecord[]
  linkedSources: any[]
}> {
  return request(`/evaluations/${id}`)
}

export async function fetchChanges(params?: {
  reportId?: string
  entityType?: string
  operator?: string
}): Promise<ChangeRecord[]> {
  const searchParams = new URLSearchParams()
  if (params?.reportId) searchParams.set('reportId', params.reportId)
  if (params?.entityType) searchParams.set('entityType', params.entityType)
  if (params?.operator) searchParams.set('operator', params.operator)
  const qs = searchParams.toString()
  return request<ChangeRecord[]>(`/changes${qs ? `?${qs}` : ''}`)
}

export async function createChange(data: {
  entityType: string
  entityId: string
  reportId?: string
  fieldName: string
  oldValue: string
  newValue: string
  operator: string
}): Promise<ChangeRecord> {
  return request<ChangeRecord>('/changes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function checkConsistency(
  reportId: string,
): Promise<ConsistencyResult> {
  return request<ConsistencyResult>(`/consistency/${reportId}`)
}

export async function fetchGuide(): Promise<GuideSection[]> {
  return request<GuideSection[]>('/guide')
}

export async function fetchModels(): Promise<Model[]> {
  return request<Model[]>('/models')
}

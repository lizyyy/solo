import type {
  SensorData,
  SafetyZone,
  ChangeRecord,
  PhotoMeta,
  ImportResult,
  PagedResponse,
  HistoryDiff,
  SafetyZoneStats,
  Batch,
} from '@/types'

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

interface PagedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `/api${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error || errorData.message || `HTTP error! status: ${response.status}`
    )
  }

  const result = await response.json() as ApiResponse<T>
  if (!result.success) {
    throw new Error(result.error || 'Request failed')
  }
  return result.data
}

export async function getSensors(
  params?: {
    page?: number
    pageSize?: number
    batchId?: string
    search?: string
  }
): Promise<PagedResponse<SensorData>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params?.batchId) searchParams.set('batchId', params.batchId)
  if (params?.search) searchParams.set('search', params.search)

  const queryString = searchParams.toString()
  const data = await fetchApi<PagedData<SensorData>>(
    `/sensors${queryString ? `?${queryString}` : ''}`
  )
  return {
    data: data.list,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

export async function getBatches(
  params?: {
    page?: number
    pageSize?: number
  }
): Promise<PagedResponse<Batch>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))

  const queryString = searchParams.toString()
  const data = await fetchApi<PagedData<Batch>>(
    `/sensors/batches${queryString ? `?${queryString}` : ''}`
  )
  return {
    data: data.list,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

export async function importSensors(
  file: File,
  batchId: string
): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('batchId', batchId)

  return fetchApi<ImportResult>('/sensors/import', {
    method: 'POST',
    body: formData,
    headers: {},
  })
}

export async function updateSensorRemark(
  sensorId: string,
  remark: string,
  reason: string,
  operator: string = 'system'
): Promise<SensorData> {
  return fetchApi<SensorData>(`/sensors/${sensorId}/remark`, {
    method: 'PUT',
    body: JSON.stringify({ remark, reason, operator }),
  })
}

export async function updateSensorCoefficient(
  sensorId: string,
  coefficient: number,
  reason: string,
  operator: string = 'system'
): Promise<SensorData> {
  return fetchApi<SensorData>(`/sensors/${sensorId}/coefficient`, {
    method: 'PUT',
    body: JSON.stringify({ coefficient, reason, operator }),
  })
}

export async function getPhotos(sensorId: string): Promise<PhotoMeta[]> {
  return fetchApi<PhotoMeta[]>(`/photos/${sensorId}`)
}

export async function uploadPhoto(
  sensorId: string,
  file: File,
  remark: string
): Promise<PhotoMeta> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('sensorId', sensorId)
  formData.append('remark', remark)

  return fetchApi<PhotoMeta>('/photos/upload', {
    method: 'POST',
    body: formData,
    headers: {},
  })
}

export async function getSafetyZones(
  params?: {
    page?: number
    pageSize?: number
    reviewStatus?: 'pending' | 'approved' | 'rollback'
    source?: 'auto' | 'manual'
  }
): Promise<PagedResponse<SafetyZone>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params?.reviewStatus) searchParams.set('review_status', params.reviewStatus)
  if (params?.source) searchParams.set('source', params.source)

  const queryString = searchParams.toString()
  const data = await fetchApi<PagedData<SafetyZone>>(
    `/safety-zones${queryString ? `?${queryString}` : ''}`
  )
  return {
    data: data.list,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

export async function reviewSafetyZone(
  zoneId: string,
  status: 'approved' | 'rollback',
  comment: string
): Promise<SafetyZone> {
  const action = status === 'approved' ? 'approve' : 'rollback'
  return fetchApi<SafetyZone>(`/safety-zones/${zoneId}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, comment }),
  })
}

export async function getPendingReviewZones(
  params?: {
    page?: number
    pageSize?: number
  }
): Promise<PagedResponse<SafetyZone & { sensor_code: string; material_type: string }>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))

  const queryString = searchParams.toString()
  const data = await fetchApi<PagedData<SafetyZone & { sensor_code: string; material_type: string }>>(
    `/safety-zones/pending-review${queryString ? `?${queryString}` : ''}`
  )
  return {
    data: data.list,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

export async function getHistory(
  params?: {
    page?: number
    pageSize?: number
    targetType?: 'sensor' | 'safety-zone'
    operator?: string
  }
): Promise<PagedResponse<ChangeRecord>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params?.targetType) {
    const dbTargetType = params.targetType === 'safety-zone' ? 'safety_zone' : params.targetType
    searchParams.set('target_type', dbTargetType)
  }
  if (params?.operator) searchParams.set('operator', params.operator)

  const queryString = searchParams.toString()
  const data = await fetchApi<PagedData<ChangeRecord>>(
    `/history${queryString ? `?${queryString}` : ''}`
  )
  return {
    data: data.list,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

export async function getHistoryDiff(
  recordId: string
): Promise<HistoryDiff> {
  return fetchApi<HistoryDiff>(`/history/${recordId}/diff`)
}

export async function rollbackHistory(
  recordId: string,
  reason: string
): Promise<ChangeRecord> {
  return fetchApi<ChangeRecord>(`/history/${recordId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function exportHistory(
  params?: {
    startDate?: string
    endDate?: string
    targetType?: 'sensor' | 'safety-zone'
  }
): Promise<Blob> {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.set('startDate', params.startDate)
  if (params?.endDate) searchParams.set('endDate', params.endDate)
  if (params?.targetType) searchParams.set('targetType', params.targetType)

  const queryString = searchParams.toString()
  const response = await fetch(
    `/api/history/export${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    )
  }

  return response.blob()
}

export async function getSafetyZoneStats(): Promise<SafetyZoneStats> {
  return fetchApi<SafetyZoneStats>('/safety-zones/stats')
}

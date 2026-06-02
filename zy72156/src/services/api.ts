import type {
  Location,
  Feedback,
  Scheme,
  Report,
  ManualNote,
  Stats,
  ApiResponse,
  SourceType,
  SchemeStatus,
  TargetType,
} from '../types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = (await res.json()) as ApiResponse<T>
  if (!data.success) throw new Error(data.error || '请求失败')
  return data.data
}

export const api = {
  getStats: () => request<Stats>('/api/stats'),

  getLocations: (params?: { search?: string; has_drift?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.has_drift != null) q.set('has_drift', String(params.has_drift))
    return request<Location[]>(`/api/locations?${q.toString()}`)
  },

  getLocation: (id: string) =>
    request<
      Location & {
        feedback: Feedback[]
        schemes: Scheme[]
        reports: Report[]
        notes: ManualNote[]
      }
    >(`/api/locations/${id}`),

  createLocation: (data: {
    canonical_name: string
    aliases?: string[]
    lat: number
    lng: number
    has_coordinate_drift?: boolean
    drift_note?: string | null
  }) => request<Location>('/api/locations', { method: 'POST', body: JSON.stringify(data) }),

  updateLocation: (
    id: string,
    data: Partial<{
      canonical_name: string
      aliases: string[]
      lat: number
      lng: number
      has_coordinate_drift: boolean
      drift_note: string | null
    }>
  ) => request<Location>(`/api/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  mergeLocations: (id: string, merge_ids: string[]) =>
    request<Location>(`/api/locations/${id}/merge`, {
      method: 'POST',
      body: JSON.stringify({ merge_ids }),
    }),

  getFeedback: (params?: {
    location_id?: string
    is_duplicate?: boolean
    is_boundary?: boolean
  }) => {
    const q = new URLSearchParams()
    if (params?.location_id) q.set('location_id', params.location_id)
    if (params?.is_duplicate != null) q.set('is_duplicate', String(params.is_duplicate))
    if (params?.is_boundary != null) q.set('is_boundary', String(params.is_boundary))
    return request<Feedback[]>(`/api/feedback?${q.toString()}`)
  },

  getFeedbackDetail: (id: string) =>
    request<
      Feedback & {
        location: Pick<Location, 'id' | 'canonical_name' | 'lat' | 'lng'>
        related_duplicates: Feedback[]
        notes: ManualNote[]
      }
    >(`/api/feedback/${id}`),

  createFeedback: (data: {
    location_id: string
    raw_location_text: string
    content?: string | null
    source: string
    source_type: SourceType
    reported_at: string
    is_duplicate?: boolean
    duplicate_of?: string | null
    is_boundary?: boolean
    boundary_note?: string | null
  }) => request<Feedback>('/api/feedback', { method: 'POST', body: JSON.stringify(data) }),

  updateFeedback: (
    id: string,
    data: Partial<{
      is_duplicate: boolean
      duplicate_of: string | null
      is_boundary: boolean
      boundary_note: string | null
      content: string
      source: string
      source_type: SourceType
    }>
  ) => request<Feedback>(`/api/feedback/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getSchemes: (params?: { location_id?: string; status?: SchemeStatus }) => {
    const q = new URLSearchParams()
    if (params?.location_id) q.set('location_id', params.location_id)
    if (params?.status) q.set('status', params.status)
    return request<Scheme[]>(`/api/schemes?${q.toString()}`)
  },

  getScheme: (id: string) =>
    request<
      Scheme & {
        location: Pick<Location, 'id' | 'canonical_name'>
        prev_version: Scheme | null
        next_version: Scheme | null
        notes: ManualNote[]
      }
    >(`/api/schemes/${id}`),

  createScheme: (data: {
    location_id: string
    title: string
    content: string
    status?: SchemeStatus
    source_refs?: string[]
    created_by?: string
  }) => request<Scheme>('/api/schemes', { method: 'POST', body: JSON.stringify(data) }),

  updateScheme: (
    id: string,
    data: Partial<{
      title: string
      content: string
      status: SchemeStatus
      manual_note: string | null
      source_refs: string[]
    }>
  ) => request<Scheme>(`/api/schemes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  supersedeScheme: (
    id: string,
    data: {
      new_title?: string
      new_content: string
      historical_opinion?: string
      created_by?: string
    }
  ) => request<Scheme>(`/api/schemes/${id}/supersede`, { method: 'POST', body: JSON.stringify(data) }),

  getReports: (params?: { location_id?: string }) => {
    const q = new URLSearchParams()
    if (params?.location_id) q.set('location_id', params.location_id)
    return request<Report[]>(`/api/reports?${q.toString()}`)
  },

  getReport: (id: string) =>
    request<
      Report & {
        location: Location
        scheme: Scheme
        notes: ManualNote[]
      }
    >(`/api/reports/${id}`),

  createReport: (data: {
    location_id: string
    scheme_id: string
    generated_by?: string
  }) => request<Report>('/api/reports', { method: 'POST', body: JSON.stringify(data) }),

  getNotes: (params: { target_type: TargetType; target_id: string }) => {
    const q = new URLSearchParams()
    q.set('target_type', params.target_type)
    q.set('target_id', params.target_id)
    return request<ManualNote[]>(`/api/notes?${q.toString()}`)
  },

  createNote: (data: {
    target_type: TargetType
    target_id: string
    content: string
    created_by?: string
  }) => request<ManualNote>('/api/notes', { method: 'POST', body: JSON.stringify(data) }),

  deleteNote: (id: string) =>
    request<{ id: string }>(`/api/notes/${id}`, { method: 'DELETE' }),
}

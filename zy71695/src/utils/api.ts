const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  projects: {
    list: () => request<any>('/projects'),
    create: (data: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request<any>(`/projects/${id}`),
    delete: (id: string) => request<any>(`/projects/${id}`, { method: 'DELETE' }),
  },
  lightRecords: {
    list: (projectId: string) => request<any>(`/light-records?project_id=${projectId}`),
    create: (data: any) => request<any>('/light-records', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/light-records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/light-records/${id}`, { method: 'DELETE' }),
  },
  trackParams: {
    list: (projectId: string) => request<any>(`/track-params?project_id=${projectId}`),
    create: (data: any) => request<any>('/track-params', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/track-params/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/track-params/${id}`, { method: 'DELETE' }),
  },
  carParams: {
    list: (projectId: string) => request<any>(`/car-params?project_id=${projectId}`),
    create: (data: any) => request<any>('/car-params', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/car-params/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/car-params/${id}`, { method: 'DELETE' }),
  },
  estimations: {
    run: (data: any) => request<any>('/estimations', { method: 'POST', body: JSON.stringify(data) }),
    list: (projectId: string) => request<any>(`/estimations?project_id=${projectId}`),
    trace: (id: string) => request<any>(`/estimations/${id}/trace`),
    confirm: (id: string) => request<any>(`/estimations/${id}/confirm`, { method: 'PUT' }),
    compare: (idA: string, idB: string) => request<any>('/estimations/compare', { method: 'POST', body: JSON.stringify({ report_id_a: idA, report_id_b: idB }) }),
    exportUrl: (id: string) => `${BASE}/estimations/${id}/export`,
  },
}

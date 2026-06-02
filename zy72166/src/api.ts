const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '请求失败')
  return json.data as T
}

export async function fetchProjects() {
  return request<any[]>('/projects')
}

export async function fetchProject(id: string) {
  return request<any>(`/projects/${id}`)
}

export async function createProject(name: string) {
  return request<any>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function importData(projectId: string, source: string, records: any[]) {
  return request<any>(`/projects/${projectId}/import`, {
    method: 'POST',
    body: JSON.stringify({ source, records }),
  })
}

export async function seedData(projectId: string) {
  return request<any>(`/projects/${projectId}/seed`, {
    method: 'POST',
  })
}

export async function fetchPrecheck(projectId: string) {
  return request<any[]>(`/projects/${projectId}/precheck`)
}

export async function fetchMergeGroups(projectId: string) {
  return request<any[]>(`/projects/${projectId}/merge-groups`)
}

export async function updateMergeGroup(projectId: string, groupId: string, strategy?: string, note?: string) {
  return request<any>(`/projects/${projectId}/merge-groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify({ strategy, note }),
  })
}

export async function fetchReviews(projectId: string) {
  return request<any[]>(`/projects/${projectId}/reviews`)
}

export async function updateReview(projectId: string, reviewId: string, status: string, verdict: string | null, reason: string, author: string) {
  return request<any>(`/projects/${projectId}/reviews/${reviewId}`, {
    method: 'PUT',
    body: JSON.stringify({ status, verdict, reason, author }),
  })
}

export async function addNote(projectId: string, reviewId: string, content: string, author: string) {
  return request<any>(`/projects/${projectId}/reviews/${reviewId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content, author }),
  })
}

export async function fetchDiff(projectId: string, reviewId: string) {
  return request<any>(`/projects/${projectId}/reviews/${reviewId}/diff`)
}

export async function resolveConflict(projectId: string, reviewId: string, resolution: string, resolvedBy: string) {
  return request<any>(`/projects/${projectId}/reviews/${reviewId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution, resolvedBy }),
  })
}

export async function fetchHistory(projectId: string, reviewId: string) {
  return request<any[]>(`/projects/${projectId}/reviews/${reviewId}/history`)
}

export async function fetchExport(projectId: string) {
  return request<any>(`/projects/${projectId}/export`)
}

export async function generateExport(projectId: string, operator: string) {
  return request<any>(`/projects/${projectId}/export/generate`, {
    method: 'POST',
    body: JSON.stringify({ operator }),
  })
}

export function downloadCsv(projectId: string) {
  window.open(`${BASE}/projects/${projectId}/export/csv`, '_blank')
}

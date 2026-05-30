import type {
  Prompt,
  PromptDetail,
  PromptVersion,
  Issue,
  IssueLog,
  SearchReport,
  SearchResult,
  StatsOverview,
  TechStackStat,
  RatingStat,
  FailureStat,
  TrendStat,
  DuplicateCheckResult,
  CreatePromptRequest,
  UpdatePromptRequest,
  CreateIssueRequest,
  SubmitFixRequest,
  ConfirmFixRequest,
  SearchRequest,
  PromptFilter,
  PaginatedResponse,
} from '../../shared/types'

const API_BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User': localStorage.getItem('currentUser') || 'current-user',
    ...(options?.headers as Record<string, string> | undefined),
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Request failed')
  }

  return data.data as T
}

export const api = {
  prompts: {
    list: (filter?: PromptFilter) => {
      const params = new URLSearchParams()
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value === undefined || value === null) return
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v))
          } else {
            params.set(key, String(value))
          }
        })
      }
      return request<PaginatedResponse<Prompt>>(
        `${API_BASE}/prompts${params.toString() ? '?' + params.toString() : ''}`
      )
    },
    get: (id: string) => request<PromptDetail>(`${API_BASE}/prompts/${id}`),
    versions: (id: string) => request<PromptVersion[]>(`${API_BASE}/prompts/${id}/versions`),
    checkDuplicates: (title: string, content: string, excludeId?: string) =>
      request<DuplicateCheckResult>(`${API_BASE}/prompts/duplicates`, {
        method: 'POST',
        body: JSON.stringify({ title, content, excludeId }),
      }),
    create: (data: CreatePromptRequest) =>
      request<PromptDetail>(`${API_BASE}/prompts`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdatePromptRequest) =>
      request<PromptDetail>(`${API_BASE}/prompts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<void>(`${API_BASE}/prompts/${id}`, { method: 'DELETE' }),
    confirmVersion: (promptId: string, version: number, confirmedBy: string) =>
      request<void>(`${API_BASE}/prompts/${promptId}/versions/${version}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirmedBy }),
      }),
  },
  tags: {
    list: () => request<string[]>(`${API_BASE}/prompts/tags`),
    techStacks: () => request<string[]>(`${API_BASE}/prompts/tech-stacks`),
    failureReasons: () => request<string[]>(`${API_BASE}/prompts/failure-reasons`),
    create: (tag: string) =>
      request<string>(`${API_BASE}/prompts/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag }),
      }),
  },
  issues: {
    list: (filters?: { type?: Issue['type']; status?: Issue['status']; severity?: Issue['severity'] }) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value)
        })
      }
      return request<Issue[]>(
        `${API_BASE}/issues${params.toString() ? '?' + params.toString() : ''}`
      )
    },
    get: (id: string) => request<Issue>(`${API_BASE}/issues/${id}`),
    logs: (id: string) => request<IssueLog[]>(`${API_BASE}/issues/${id}/log`),
    create: (data: CreateIssueRequest) =>
      request<Issue>(`${API_BASE}/issues`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    submitFix: (id: string, data: SubmitFixRequest) =>
      request<Issue>(`${API_BASE}/issues/${id}/submit-fix`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    confirmFix: (id: string, data: ConfirmFixRequest) =>
      request<Issue>(`${API_BASE}/issues/${id}/confirm-fix`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    rejectFix: (id: string, actor: string, comment: string) =>
      request<Issue>(`${API_BASE}/issues/${id}/reject-fix`, {
        method: 'POST',
        body: JSON.stringify({ actor, comment }),
      }),
    close: (id: string, actor: string, comment: string) =>
      request<Issue>(`${API_BASE}/issues/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ actor, comment }),
      }),
    autoDetect: () =>
      request<Issue[]>(`${API_BASE}/issues/auto-detect`, { method: 'POST' }),
  },
  search: {
    fulltext: (q: string, limit?: number) => {
      const params = new URLSearchParams({ q })
      if (limit) params.set('limit', String(limit))
      return request<SearchResult[]>(`${API_BASE}/search/fulltext?${params.toString()}`)
    },
    similar: (data: SearchRequest) =>
      request<SearchReport>(`${API_BASE}/search/similar`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    reports: (limit?: number) => {
      const params = limit ? `?limit=${limit}` : ''
      return request<SearchReport[]>(`${API_BASE}/search/reports${params}`)
    },
    report: (id: string) => request<SearchReport>(`${API_BASE}/search/reports/${id}`),
  },
  stats: {
    overview: () => request<StatsOverview>(`${API_BASE}/stats/overview`),
    techStack: () => request<TechStackStat[]>(`${API_BASE}/stats/tech-stack`),
    rating: () => request<RatingStat[]>(`${API_BASE}/stats/rating`),
    failures: () => request<FailureStat[]>(`${API_BASE}/stats/failures`),
    trend: (days?: number) => {
      const params = days ? `?days=${days}` : ''
      return request<TrendStat[]>(`${API_BASE}/stats/trend${params}`)
    },
  },
}

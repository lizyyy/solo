import {
  Problem, ProblemVersion, Confirmation, AnomalyRecord, ChannelStatus,
  VersionDiff, ProblemWithDetails, CreateProblemRequest, CreateVersionRequest,
  ConfirmRequest
} from '../types'

const API_BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

export const problemApi = {
  getProblems: (filters?: { status?: string; channel?: number; musician?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.channel) params.append('channel', filters.channel.toString())
    if (filters?.musician) params.append('musician', filters.musician)
    const query = params.toString()
    return request<Problem[]>(`/problems${query ? `?${query}` : ''}`)
  },

  getProblemById: (id: string) => {
    return request<ProblemWithDetails>(`/problems/${id}`)
  },

  createProblem: (data: CreateProblemRequest) => {
    return request<Problem>('/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getVersions: (problemId: string) => {
    return request<ProblemVersion[]>(`/problems/${problemId}/versions`)
  },

  compareVersions: (problemId: string, v1: number, v2: number) => {
    return request<VersionDiff[]>(`/problems/${problemId}/versions/${v1}/${v2}`)
  },

  createVersion: (problemId: string, data: CreateVersionRequest) => {
    return request<ProblemVersion>(`/problems/${problemId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  confirm: (problemId: string, data: ConfirmRequest) => {
    return request<Confirmation>(`/problems/${problemId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}

export const channelApi = {
  getStatus: () => {
    return request<ChannelStatus[]>('/channels/status')
  },
}

export const anomalyApi = {
  getAll: () => {
    return request<AnomalyRecord[]>('/anomalies')
  },
}

export const reportApi = {
  getReportData: (filters?: { rehearsalId?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams()
    if (filters?.rehearsalId) params.append('rehearsalId', filters.rehearsalId)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    const query = params.toString()
    return request<ProblemWithDetails[]>(`/report${query ? `?${query}` : ''}`)
  },
}

export const healthApi = {
  check: () => {
    return request<{ status: string; timestamp: string }>('/health')
  },
}

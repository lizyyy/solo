import { CourtSession, Member, CreateSessionRequest, AddPlayerRequest } from './types'

const API_BASE = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '请求失败')
  }
  
  return response.json()
}

export const api = {
  getSessions: () => request<CourtSession[]>('/sessions'),
  getSession: (id: string) => request<CourtSession>(`/sessions/${id}`),
  createSession: (data: CreateSessionRequest) => request<CourtSession>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  addPlayer: (sessionId: string, data: AddPlayerRequest) => 
    request(`/sessions/${sessionId}/players`, { method: 'POST', body: JSON.stringify(data) }),
  confirmPlayer: (sessionId: string, playerId: string) =>
    request(`/sessions/${sessionId}/players/${playerId}/confirm`, { method: 'POST' }),
  cancelPlayer: (sessionId: string, playerId: string) =>
    request(`/sessions/${sessionId}/players/${playerId}/cancel`, { method: 'POST' }),
  refundPlayer: (sessionId: string, playerId: string) =>
    request(`/sessions/${sessionId}/players/${playerId}/refund`, { method: 'POST' }),
  cancelSession: (sessionId: string) =>
    request(`/sessions/${sessionId}/cancel`, { method: 'POST' }),
  completeSession: (sessionId: string) =>
    request(`/sessions/${sessionId}/complete`, { method: 'POST' }),
  checkAutoCancel: (sessionId: string) =>
    request<{ cancelled: boolean; reason?: string }>(`/sessions/${sessionId}/check-auto-cancel`, { method: 'POST' }),
  getMembers: () => request<Member[]>('/members')
}

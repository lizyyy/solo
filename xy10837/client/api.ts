import { DeadLetterMessage, ReplayBatch, SkipRule, MessageStatus } from './types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getMessages: (filters?: { topic?: string; status?: MessageStatus }) =>
    request<DeadLetterMessage[]>(`/messages?${new URLSearchParams(filters as any)}`),
  
  getMessage: (id: string) =>
    request<DeadLetterMessage>(`/messages/${id}`),
  
  replayMessage: (id: string, operator: string) =>
    request(`/messages/${id}/replay`, {
      method: 'POST',
      body: JSON.stringify({ operator }),
    }),
  
  skipMessage: (id: string, operator: string, reason: string) =>
    request(`/messages/${id}/skip`, {
      method: 'POST',
      body: JSON.stringify({ operator, reason }),
    }),
  
  getTopics: () => request<string[]>('/topics'),
  
  getBatches: () => request<ReplayBatch[]>('/batches'),
  
  createBatch: (data: { name: string; topic: string; messageIds: string[]; rateLimit: number; operator: string }) =>
    request<ReplayBatch>('/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  startBatch: (id: string) =>
    request(`/batches/${id}/start`, { method: 'POST' }),
  
  pauseBatch: (id: string) =>
    request(`/batches/${id}/pause`, { method: 'POST' }),
  
  getRules: () => request<SkipRule[]>('/rules'),
  
  createRule: (data: Omit<SkipRule, 'id' | 'createdAt'>) =>
    request<SkipRule>('/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateRule: (id: string, data: Partial<SkipRule>) =>
    request<SkipRule>(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteRule: (id: string) =>
    request(`/rules/${id}`, { method: 'DELETE' }),
  
  export: (filters?: { topic?: string; status?: MessageStatus; format?: string }) =>
    `${API_BASE}/export?${new URLSearchParams(filters as any)}`,
};

import { Bill, Group, Event, Conflict, SyncState, BalanceResult, ReportOptions, User } from '../types';

const API_BASE = '/api';
const CLIENT_ID = localStorage.getItem('clientId') || `client-${Date.now()}`;
let USER_ID = localStorage.getItem('userId') || '';

if (!USER_ID) {
  USER_ID = `user-${Date.now()}`;
  localStorage.setItem('userId', USER_ID);
}

localStorage.setItem('clientId', CLIENT_ID);

console.log('Client ID:', CLIENT_ID);
console.log('User ID:', USER_ID);

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  needHeaders: boolean = true
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Client-Id': CLIENT_ID,
    'X-User-Id': USER_ID,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: needHeaders ? headers : options.headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.arrayBuffer() as unknown as T;
}

export const api = {
  users: {
    getOrCreate: (userId: string, options?: { name?: string; avatar?: string }) =>
      request<User>('/users/get-or-create', {
        method: 'POST',
        body: JSON.stringify(options || {}),
        headers: { 'X-User-Id': userId },
      }),

    getById: (userId: string) =>
      request<User>(`/users/${userId}`),

    getAll: () =>
      request<User[]>('/users'),
  },

  bills: {
    create: (bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deleted'>) =>
      request<Bill>('/bills', {
        method: 'POST',
        body: JSON.stringify(bill),
      }),

    update: (id: string, version: number, updates: Partial<Bill>) =>
      request<Bill>(`/bills/${id}`, {
        method: 'PUT',
        headers: { 'If-Match': String(version) },
        body: JSON.stringify(updates),
      }),

    delete: (id: string, version: number) =>
      request(`/bills/${id}`, {
        method: 'DELETE',
        headers: { 'If-Match': String(version) },
      }),

    getByGroup: (groupId: string) =>
      request<Bill[]>(`/bills/group/${groupId}`),

    getById: (id: string) =>
      request<Bill>(`/bills/${id}`),

    getBalances: (groupId: string) =>
      request<BalanceResult>(`/bills/group/${groupId}/balances`),
  },

  groups: {
    create: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'version'>) =>
      request<Group>('/groups', {
        method: 'POST',
        body: JSON.stringify(group),
      }),

    update: (id: string, version: number, updates: Partial<Group>) =>
      request<Group>(`/groups/${id}`, {
        method: 'PUT',
        headers: { 'If-Match': String(version) },
        body: JSON.stringify(updates),
      }),

    getByUser: (userId: string) =>
      request<Group[]>(`/groups/user/${userId}`),

    getById: (id: string) =>
      request<Group>(`/groups/${id}`),
  },

  reports: {
    export: (options: ReportOptions) =>
      request<ArrayBuffer>('/reports/export', {
        method: 'POST',
        body: JSON.stringify(options),
      }),
  },

  events: {
    getByAggregate: (id: string) =>
      request<Event[]>(`/events/aggregate/${id}`),

    getByUser: (userId: string, limit = 100) =>
      request<Event[]>(`/events/user/${userId}?limit=${limit}`),

    getConflicts: (limit = 100) =>
      request<Conflict[]>(`/events/conflicts?limit=${limit}`),

    resolveConflict: (id: string, resolution: any) =>
      request<Conflict>(`/events/conflicts/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution }),
      }),

    getSyncState: () =>
      request<SyncState>('/events/sync/state'),

    sync: (localEvents: Event[], lastKnownVersion: number) =>
      request(`/events/sync`, {
        method: 'POST',
        body: JSON.stringify({ localEvents, lastKnownServerVersion: lastKnownVersion }),
      }),

    replay: (aggregateId: string, targetVersion: number) =>
      request(`/events/replay/${aggregateId}`, {
        method: 'POST',
        body: JSON.stringify({ targetVersion }),
      }),
  },

  health: () => request<{ status: string; timestamp: number }>('/health'),
};

export { CLIENT_ID, USER_ID };

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface User {
  id: string;
  name: string;
  email: string;
  currentPlan: string;
  currentBenefits: string[];
  validFrom: string | null;
  validUntil: string | null;
  devices: Device[];
  syncStatus: {
    status: string;
    message: string;
  };
}

export interface DeviceDiff {
  missingBenefits: string[];
  planMismatch: boolean;
}

export interface Device {
  id: string;
  type: string;
  name: string;
  lastSync: string;
  syncStatus?: string;
  expected?: {
    plan: string;
    benefits: string[];
  };
  actual?: {
    plan: string;
    benefits: string[];
  };
  diff: DeviceDiff | null;
}

export interface Event {
  id: string;
  userId: string;
  type: string;
  timestamp: string;
  data: any;
  description: string;
}

export interface UserDetail {
  user: User;
  events: Event[];
  deviceStatus: Device[];
}

export interface SyncStatus {
  deviceSyncStatus: any[];
  diffSnapshot: any;
  compensationAvailable: boolean;
}

export const userApi = {
  getUsers: () => api.get<{ success: boolean; data: User[] }>('/users'),
  getUserDetail: (userId: string) => api.get<{ success: boolean; data: UserDetail }>(`/users/${userId}`),
};

export const eventApi = {
  getEvents: (userId: string) => api.get<{ success: boolean; data: Event[] }>(`/events/${userId}`),
  sendEvent: (event: any) => api.post('/events', event),
};

export const syncApi = {
  getSyncStatus: (userId: string) => api.get<{ success: boolean; data: SyncStatus }>(`/sync/${userId}`),
  triggerCompensation: (userId: string, deviceId?: string) => 
    api.post('/sync/compensate', { userId, deviceId }),
};

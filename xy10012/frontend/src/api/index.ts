import axios from 'axios';

export interface Task {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REOPENED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: string | null;
  creatorId: string;
  dueDate?: string | null;
  completedAt?: string | null;
  orderNumber?: string | null;
  trackingNumber?: string | null;
  refundAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  customer?: Customer;
  creator?: User;
  assignee?: User | null;
  notes?: Note[];
  _count?: { notes: number };
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Note {
  id: string;
  taskId: string;
  createdBy: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user: User;
}

export interface TaskVersion {
  id: string;
  taskId: string;
  versionNumber: number;
  title: string;
  description?: string | null;
  status: Task['status'];
  priority: Task['priority'];
  assigneeId?: string | null;
  dueDate?: string | null;
  orderNumber?: string | null;
  trackingNumber?: string | null;
  refundAmount?: number | null;
  snapshotData: any;
  createdAt: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  previousState?: any;
  newState?: any;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string | null;
  requestId?: string | null;
  timestamp: string;
  user: User;
}

export interface PaginatedResponse<T> {
  tasks: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  requestId?: string;
  currentVersion?: number;
  yourVersion?: number;
}

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const taskApi = {
  async list(params: {
    status?: string[];
    priority?: string[];
    assigneeId?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PaginatedResponse<Task>> {
    const response = await api.get('/tasks', { params });
    return response.data;
  },

  async get(id: string): Promise<{ data: Task }> {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  async create(data: Partial<Task>): Promise<{ data: Task; isDuplicate: boolean }> {
    const response = await api.post('/tasks', data);
    return response.data;
  },

  async update(id: string, data: Partial<Task> & { expectedVersion: number }): Promise<{ data: Task }> {
    const response = await api.put(`/tasks/${id}`, data);
    return response.data;
  },

  async delete(id: string, reason?: string): Promise<void> {
    await api.delete(`/tasks/${id}`, { data: { reason } });
  },

  async getVersions(id: string): Promise<{ data: TaskVersion[] }> {
    const response = await api.get(`/tasks/${id}/versions`);
    return response.data;
  },

  async rollback(id: string, versionNumber: number, reason?: string): Promise<{ data: Task }> {
    const response = await api.post(`/tasks/${id}/rollback`, {
      versionNumber,
      reason,
    });
    return response.data;
  },

  async getHistory(id: string, limit?: number, offset?: number): Promise<{ logs: AuditLog[]; total: number }> {
    const response = await api.get(`/tasks/${id}/history`, {
      params: { limit, offset },
    });
    return response.data;
  },

  async getReplay(id: string): Promise<{ data: any[] }> {
    const response = await api.get(`/tasks/${id}/replay`);
    return response.data;
  },

  async export(
    format: 'excel' | 'markdown' | 'pdf',
    params?: {
      status?: string[];
      priority?: string[];
      assigneeId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Blob> {
    const response = await api.get(`/tasks/export/${format}`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  async exportSingle(
    id: string,
    format: 'excel' | 'markdown' | 'pdf'
  ): Promise<Blob> {
    const response = await api.get(`/tasks/${id}/export/${format}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export { api };
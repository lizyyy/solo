import { ViolationFilterParams } from '../types';

const API_BASE = 'http://localhost:3001/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(errorData.error || `请求失败: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || result.message || '请求失败');
    }
    return result.data;
  } catch (error) {
    console.error('API 请求错误:', error);
    throw error;
  }
}

export const driverApi = {
  getAll: () => request<any[]>('/drivers'),
  getById: (id: string) => request<any>(`/drivers/${id}`),
  create: (data: any) => request<any>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/drivers/${id}`, { method: 'DELETE' }),
};

export const vehicleApi = {
  getAll: () => request<any[]>('/vehicles'),
  getById: (id: string) => request<any>(`/vehicles/${id}`),
  create: (data: any) => request<any>('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/vehicles/${id}`, { method: 'DELETE' }),
};

export const shiftApi = {
  getAll: () => request<any[]>('/shifts'),
  getByVehicleId: (vehicleId: string) => request<any[]>(`/shifts/vehicle/${vehicleId}`),
  create: (data: any) => request<any>('/shifts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/shifts/${id}`, { method: 'DELETE' }),
};

export const historyApi = {
  getByViolationId: (violationId: string) => request<any[]>(`/history/violation/${violationId}`),
};

export const violationApi = {
  getAll: () => request<any[]>('/violations'),
  filter: (params: ViolationFilterParams) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
    return request<any>(`/violations?${query.toString()}`);
  },
  getById: (id: string) => request<any>(`/violations/${id}`),
  import: (data: any[], fileName: string, importedBy: string = '管理员') =>
    request<any>('/violations/import', {
      method: 'POST',
      body: JSON.stringify({ data, fileName, importedBy }),
    }),
  matchShift: (id: string, shiftId: string, operator: string = '管理员') =>
    request<any>(`/violations/${id}/match-shift`, {
      method: 'POST',
      body: JSON.stringify({ shiftId, operator, operatorId: 'admin' }),
    }),
  confirm: (id: string, driverId: string, operator: string = '管理员') =>
    request<any>(`/violations/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ driverId, operator, operatorId: 'admin' }),
    }),
  submitAppeal: (id: string, driverId: string, reason: string, materials: any[] = []) =>
    request<any>(`/violations/${id}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ driverId, reason, materials }),
    }),
  reviewAppeal: (id: string, approved: boolean, reviewNotes: string, reviewer: string = '管理员') =>
    request<any>(`/violations/${id}/review-appeal`, {
      method: 'POST',
      body: JSON.stringify({ approved, reviewNotes, reviewer, reviewerId: 'admin' }),
    }),
  applyPenalty: (id: string, operator: string = '管理员') =>
    request<any>(`/violations/${id}/penalty`, {
      method: 'POST',
      body: JSON.stringify({ operator, operatorId: 'admin' }),
    }),
  rollbackPenalty: (id: string, reason: string, operator: string = '管理员') =>
    request<any>(`/violations/${id}/rollback-penalty`, {
      method: 'POST',
      body: JSON.stringify({ reason, operator, operatorId: 'admin' }),
    }),
  getPenalty: (id: string) => request<any>(`/violations/${id}/penalty`),
  getAppeal: (id: string) => request<any>(`/violations/${id}/appeal`),
};

export const batchApi = {
  getAll: () => request<any[]>('/batches'),
  import: (data: any[], fileName: string, importedBy: string = '管理员') =>
    request<any>('/batches/import', {
      method: 'POST',
      body: JSON.stringify({ data, fileName, importedBy }),
    }),
};

export const initData = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

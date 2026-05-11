import axios from 'axios';
import type {
  CourierCompany,
  RetentionRule,
  Package,
  Settlement,
  PackageStats,
  SettlementStats,
  ImportResult
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export const courierCompanyApi = {
  getAll: () => api.get<CourierCompany[]>('/courier-companies'),
  create: (data: Omit<CourierCompany, 'id' | 'created_at'>) =>
    api.post<CourierCompany>('/courier-companies', data),
  update: (id: number, data: Omit<CourierCompany, 'id' | 'created_at'>) =>
    api.put<CourierCompany>(`/courier-companies/${id}`, data),
  delete: (id: number) => api.delete(`/courier-companies/${id}`)
};

export const retentionRuleApi = {
  getAll: () => api.get<RetentionRule[]>('/retention-rules'),
  create: (data: Omit<RetentionRule, 'id' | 'created_at' | 'courier_company_name'>) =>
    api.post<RetentionRule>('/retention-rules', data),
  update: (id: number, data: Omit<RetentionRule, 'id' | 'created_at' | 'courier_company_name'>) =>
    api.put<RetentionRule>(`/retention-rules/${id}`, data),
  delete: (id: number) => api.delete(`/retention-rules/${id}`)
};

export const packageApi = {
  getAll: (params?: {
    status?: string;
    courier_company_id?: number;
    start_date?: string;
    end_date?: string;
    keyword?: string;
  }) => api.get<Package[]>('/packages', { params }),
  getById: (id: number) => api.get<Package>(`/packages/${id}`),
  getStats: (params?: {
    courier_company_id?: number;
    start_date?: string;
    end_date?: string;
  }) => api.get<PackageStats>('/packages/stats', { params }),
  create: (data: Omit<Package, 'id' | 'created_at' | 'status' | 'scan_time' | 'total_fee' | 'return_fee' | 'storage_fee' | 'retention_days'>) =>
    api.post<Package>('/packages', data),
  scan: (tracking_number: string) =>
    api.post<Package>('/packages/scan', { tracking_number }),
  deliver: (id: number) => api.patch<Package>(`/packages/${id}/deliver`),
  return: (id: number) => api.patch<Package>(`/packages/${id}/return`),
  delete: (id: number) => api.delete(`/packages/${id}`),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ImportResult>('/packages/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const settlementApi = {
  getAll: (params?: { status?: string; courier_company_id?: number }) =>
    api.get<Settlement[]>('/settlements', { params }),
  getById: (id: number) => api.get<Settlement>(`/settlements/${id}`),
  getStats: () => api.get<SettlementStats>('/settlements/stats'),
  create: (data: { courier_company_id: number; start_date: string; end_date: string }) =>
    api.post<Settlement>('/settlements', data),
  confirm: (id: number) => api.patch<Settlement>(`/settlements/${id}/confirm`),
  export: (id: number) => api.get<{ settlement: Settlement; packages: Package[] }>(`/settlements/${id}/export`)
};

export const healthApi = {
  check: () => api.get('/health')
};

export default api;

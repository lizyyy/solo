import axios from 'axios';
import { ApiResponse, DashboardStats, BlockEvent, AllowRecord, PaginatedResponse, RiskCheckResult, PromoCode } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const riskApi = {
  checkRisk: (data: { promoCode: string; deviceId: string; userId?: string; ipAddress: string; userAgent: string }) =>
    api.post<ApiResponse<RiskCheckResult>>('/risk/check', data),

  getBlockEvents: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<ApiResponse<PaginatedResponse<BlockEvent>>>('/risk/block-events', { params }),

  getBlockEventDetail: (id: string) =>
    api.get<ApiResponse<BlockEvent>>(`/risk/block-events/${id}`),

  manualAllow: (id: string, data?: { approvedBy?: string; note?: string }) =>
    api.post<ApiResponse>(`/risk/block-events/${id}/allow`, data),

  compensate: (id: string, data?: { compensatedBy?: string; note?: string }) =>
    api.post<ApiResponse>(`/risk/block-events/${id}/compensate`, data),

  exportBlockEvents: () =>
    api.get('/risk/block-events/export', { responseType: 'blob' }),

  getAllowRecords: (params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<PaginatedResponse<AllowRecord>>>('/risk/allow-records', { params }),

  getDashboardStats: () =>
    api.get<ApiResponse<DashboardStats>>('/risk/dashboard'),
};

export const promoCodeApi = {
  create: (data: { code: string; discountType: string; discountValue: number; maxUsage?: number; validFrom: string; validTo: string }) =>
    api.post<ApiResponse>('/promo-codes', data),

  getAll: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<ApiResponse<PaginatedResponse<PromoCode>>>('/promo-codes', { params }),

  getDetail: (id: string) =>
    api.get<ApiResponse<PromoCode>>(`/promo-codes/${id}`),

  updateStatus: (id: string, status: string) =>
    api.put<ApiResponse>(`/promo-codes/${id}/status`, { status }),
};

export default api;

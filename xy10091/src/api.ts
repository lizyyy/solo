import axios from 'axios';
import type { ReissueRequest, ReviewHistory, ReviewFilters, PaginatedResponse, ReportData } from './types';

const api = axios.create({
  baseURL: '/api',
});

export const requestsApi = {
  getList: (filters: ReviewFilters & { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<ReissueRequest>>('/requests', { params: filters }),

  getById: (id: string) =>
    api.get<ReissueRequest>(`/requests/${id}`),

  getHistory: (id: string) =>
    api.get<ReviewHistory[]>(`/requests/${id}/history`),

  create: (data: { studentId: string; courseCode: string; courseName: string; reason: string }) =>
    api.post<{ id: string; success: boolean }>('/requests', data),

  approve: (id: string, data: { comment?: string; reviewerName?: string }) =>
    api.post(`/requests/${id}/approve`, data),

  reject: (id: string, data: { comment: string; reviewerName?: string }) =>
    api.post(`/requests/${id}/reject`, data),

  markAbnormal: (id: string, data: { abnormalType: string; abnormalReason: string; reviewerName?: string }) =>
    api.post(`/requests/${id}/abnormal`, data),

  ship: (id: string, data: { trackingNumber: string }) =>
    api.post(`/requests/${id}/ship`, data),

  getCourses: () =>
    api.get<{ courseCode: string; courseName: string }[]>('/courses'),

  searchStudents: (keyword: string) =>
    api.get<any[]>('/students/search', { params: { keyword } }),
};

export const reportApi = {
  getReport: () =>
    api.get<ReportData>('/report'),
};

export const exportApi = {
  exportCSV: (filters: ReviewFilters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const url = `/api/export?${params.toString()}`;
    window.open(url, '_blank');
  },
};

export default api;

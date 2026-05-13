import axios from 'axios';
import {
  LineChangePlan,
  MoldInspection,
  MaterialKitting,
  FirstArticleInspection,
  MissingItem,
  PersonQualification,
  StatusHistory,
  ChangeLog,
  Statistics,
  ApiResponse
} from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const plansApi = {
  getAll: () => api.get<ApiResponse<LineChangePlan[]>>('/plans'),
  getById: (id: string) => api.get<ApiResponse<LineChangePlan>>(`/plans/${id}`),
  create: (data: Partial<LineChangePlan>) => api.post<ApiResponse<LineChangePlan>>('/plans', data),
  update: (id: string, data: Partial<LineChangePlan>) => api.put<ApiResponse<LineChangePlan>>(`/plans/${id}`, data),
  getHistory: (id: string) => api.get<ApiResponse<StatusHistory[]>>(`/plans/${id}/history`),
  getChangeLog: (id: string) => api.get<ApiResponse<ChangeLog[]>>(`/plans/${id}/changelog`),
};

export const moldApi = {
  getAll: () => api.get<ApiResponse<MoldInspection[]>>('/mold-inspections'),
  getById: (id: string) => api.get<ApiResponse<MoldInspection>>(`/mold-inspections/${id}`),
  getByPlan: (planId: string) => api.get<ApiResponse<MoldInspection[]>>(`/mold-inspections/plan/${planId}`),
  create: (data: Partial<MoldInspection>) => api.post<ApiResponse<MoldInspection>>('/mold-inspections', data),
  updateItem: (inspectionId: string, itemId: string, data: any) =>
    api.put<ApiResponse<MoldInspection>>(`/mold-inspections/${inspectionId}/items/${itemId}`, data),
  review: (id: string, data: any) => api.post<ApiResponse<MoldInspection>>(`/mold-inspections/${id}/review`, data),
  validate: (id: string) => api.get<ApiResponse<{ valid: boolean; errors: string[] }>>(`/mold-inspections/${id}/validate`),
};

export const materialApi = {
  getAll: () => api.get<ApiResponse<MaterialKitting[]>>('/material-kittings'),
  getById: (id: string) => api.get<ApiResponse<MaterialKitting>>(`/material-kittings/${id}`),
  getByPlan: (planId: string) => api.get<ApiResponse<MaterialKitting[]>>(`/material-kittings/plan/${planId}`),
  create: (data: Partial<MaterialKitting>) => api.post<ApiResponse<MaterialKitting>>('/material-kittings', data),
  updateItem: (kittingId: string, itemId: string, data: any) =>
    api.put<ApiResponse<MaterialKitting>>(`/material-kittings/${kittingId}/items/${itemId}`, data),
};

export const firstArticleApi = {
  getAll: () => api.get<ApiResponse<FirstArticleInspection[]>>('/first-articles'),
  getById: (id: string) => api.get<ApiResponse<FirstArticleInspection>>(`/first-articles/${id}`),
  getByPlan: (planId: string) => api.get<ApiResponse<FirstArticleInspection[]>>(`/first-articles/plan/${planId}`),
  create: (data: Partial<FirstArticleInspection>) => api.post<ApiResponse<FirstArticleInspection>>('/first-articles', data),
  updateItem: (inspectionId: string, itemId: string, data: any) =>
    api.put<ApiResponse<FirstArticleInspection>>(`/first-articles/${inspectionId}/items/${itemId}`, data),
  review: (id: string, data: any) => api.post<ApiResponse<FirstArticleInspection>>(`/first-articles/${id}/review`, data),
};

export const qualificationApi = {
  getAll: () => api.get<ApiResponse<PersonQualification[]>>('/qualifications'),
  getByPerson: (personId: string) => api.get<ApiResponse<PersonQualification[]>>(`/qualifications/person/${personId}`),
  getValidByPerson: (personId: string) => api.get<ApiResponse<PersonQualification[]>>(`/qualifications/person/${personId}/valid`),
  checkQualified: (personId: string, requiredTypes: string[]) =>
    api.post<ApiResponse<{ qualified: boolean; missingTypes: string[] }>>(`/qualifications/${personId}/check`, { requiredTypes }),
};

export const missingItemApi = {
  getAll: () => api.get<ApiResponse<MissingItem[]>>('/missing-items'),
  getByPlan: (planId: string) => api.get<ApiResponse<MissingItem[]>>(`/missing-items/plan/${planId}`),
  create: (data: Partial<MissingItem>) => api.post<ApiResponse<MissingItem>>('/missing-items', data),
  update: (id: string, data: Partial<MissingItem>) => api.put<ApiResponse<MissingItem>>(`/missing-items/${id}`, data),
};

export const statisticsApi = {
  get: () => api.get<ApiResponse<Statistics>>('/statistics'),
};

export const exportApi = {
  exportExcel: (data: any) =>
    api.post('/export', data, {
      responseType: 'blob',
    }),
};

export default api;

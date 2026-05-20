import axios from 'axios';
import { Incident } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export const incidentApi = {
  getAll: (params?: { status?: string; severity?: string; page?: number; limit?: number }) =>
    api.get<{ data: Incident[]; pagination: { page: number; limit: number; total: number } }>('/incidents', { params }),
  
  getById: (id: string) => api.get<Incident>(`/incidents/${id}`),
  
  create: (data: Partial<Incident>) => api.post<Incident>('/incidents', data),
  
  updateStatus: (id: string, newStatus: string, operator: string, reason?: string) =>
    api.patch<Incident>(`/incidents/${id}/status`, { newStatus, operator, reason }),
  
  addTimeline: (id: string, data: { event: string; operator: string; description?: string; timestamp?: string }) =>
    api.post<Incident>(`/incidents/${id}/timeline`, data),
  
  addEvidence: (id: string, data: { type: string; title: string; url: string; description?: string; uploadedBy: string }) =>
    api.post<Incident>(`/incidents/${id}/evidence`, data),
  
  addAffectedInterface: (id: string, data: any) =>
    api.post<Incident>(`/incidents/${id}/affected-interface`, data),
  
  addActionItem: (id: string, data: any) =>
    api.post<Incident>(`/incidents/${id}/action-item`, data),
  
  updateActionItemStatus: (id: string, actionItemId: string, status: string, operator: string) =>
    api.patch<Incident>(`/incidents/${id}/action-item/${actionItemId}/status`, { status, operator }),
  
  setReviewConclusion: (id: string, data: any) =>
    api.post<Incident>(`/incidents/${id}/review-conclusion`, data),
  
  addCompensation: (id: string, data: { type: string; description: string; operator: string; result?: string }) =>
    api.post<Incident>(`/incidents/${id}/compensation`, data),
  
  addFailureReason: (id: string, data: { reason: string; operator: string; category?: string }) =>
    api.post<Incident>(`/incidents/${id}/failure-reason`, data),
  
  export: (id: string) =>
    api.get(`/incidents/${id}/export`, { responseType: 'blob' }),
  
  getTimelineSummary: (id: string) =>
    api.get(`/incidents/${id}/timeline-summary`),
};

export default api;

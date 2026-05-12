import axios from 'axios';
import type { ServiceDashboard, DetailedDashboard, RiskItem, MetricsGap, ExceptionApproval, FreezeRecord, Service } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const dashboardAPI = {
  getOverview: () => api.get<ServiceDashboard[]>('/overview').then(r => r.data),
  getServiceDetail: (id: string) => api.get<DetailedDashboard>(`/services/${id}`).then(r => r.data),
  getServices: () => api.get<Service[]>('/services').then(r => r.data),
  getRiskList: () => api.get<RiskItem[]>('/risk-list').then(r => r.data),
  getMetricsGaps: () => api.get<MetricsGap[]>('/metrics-gaps').then(r => r.data),
  getExceptions: () => api.get<ExceptionApproval[]>('/exceptions').then(r => r.data),
  getFreezes: () => api.get<FreezeRecord[]>('/freezes').then(r => r.data),
  
  createException: (data: {
    serviceId: string;
    endpointId?: string;
    releaseId: string;
    reason: string;
    requestedBy: string;
    expiresInHours?: number;
  }) => api.post('/exceptions', data).then(r => r.data),
  
  approveException: (id: string, approvedBy?: string) => 
    api.post(`/exceptions/${id}/approve`, { approvedBy }).then(r => r.data),
  
  rejectException: (id: string, approvedBy?: string) => 
    api.post(`/exceptions/${id}/reject`, { approvedBy }).then(r => r.data),
  
  createFreeze: (data: {
    serviceId: string;
    endpointId?: string;
    reason: string;
    reasonDetail: string;
    triggeredBy?: string;
  }) => api.post('/freezes', data).then(r => r.data),
  
  liftFreeze: (id: string, liftedBy?: string) => 
    api.post(`/freezes/${id}/lift`, { liftedBy }).then(r => r.data),
  
  submitMetrics: (metrics: Array<{
    serviceId: string;
    endpointId?: string;
    timestamp?: number;
    totalRequests: number;
    errorRequests: number;
    p50LatencyMs: number;
    p99LatencyMs: number;
    source?: 'api' | 'import' | 'generated';
  }>) => api.post('/metrics', metrics).then(r => r.data),
  
  exportRiskList: () => {
    window.open('/api/export/risk-list', '_blank');
  },
  
  generateSampleData: () => api.post('/sample-data').then(r => r.data),
};

import axios from 'axios';
import type {
  Service,
  Dependency,
  DegradeRule,
  DrillPlan,
  DrillResult,
} from './types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const topologyApi = {
  get: () => api.get<{ services: Service[]; dependencies: Dependency[] }>('/topology'),
};

export const rulesApi = {
  list: () => api.get<DegradeRule[]>('/rules'),
  get: (id: string) => api.get<DegradeRule>(`/rules/${id}`),
  create: (rule: Partial<DegradeRule>) => api.post<DegradeRule>('/rules', rule),
  update: (id: string, rule: Partial<DegradeRule>) => api.put<DegradeRule>(`/rules/${id}`, rule),
  delete: (id: string) => api.delete(`/rules/${id}`),
};

export const drillApi = {
  listPlans: () => api.get<DrillPlan[]>('/drill/plans'),
  getPlan: (id: string) => api.get<DrillPlan>(`/drill/plans/${id}`),
  createPlan: (plan: Partial<DrillPlan>) => api.post<DrillPlan>('/drill/plans', plan),
  updatePlan: (id: string, plan: Partial<DrillPlan>) => api.put<DrillPlan>(`/drill/plans/${id}`, plan),
  getCurrent: () => api.get<DrillResult | null>('/drill/current'),
  start: (planId: string) => api.post<DrillResult>(`/drill/start/${planId}`),
  runRecovery: (resultId: string) => api.post<DrillResult>(`/drill/recovery/${resultId}`),
  listResults: () => api.get<DrillResult[]>('/drill/results'),
  getResult: (id: string) => api.get<DrillResult>(`/drill/results/${id}`),
  exportReport: (id: string) => {
    window.open(`/api/drill/results/${id}/export`, '_blank');
  },
};

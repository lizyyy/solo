import axios from 'axios';
import { 
  ILead, 
  ISalesPerson, 
  IAssignmentRule, 
  IDashboardStats,
  IImportResult,
  IFollowUpRecord
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

export const leadApi = {
  importLeads: (leads: Partial<ILead>[]) => 
    api.post<{ success: boolean; data: IImportResult }>('/leads/import', { leads }),
  
  getLeads: (filters?: any) => 
    api.get<{ success: boolean; data: ILead[] }>('/leads', { params: filters }),
  
  getLeadById: (id: string) => 
    api.get<{ success: boolean; data: { lead: ILead; followUpRecords: IFollowUpRecord[] } }>(`/leads/${id}`),
  
  updateStatus: (id: string, status: string, notes?: string) => 
    api.put<{ success: boolean; data: ILead }>(`/leads/${id}/status`, { status, notes }),
  
  assign: (id: string, salesId: string) => 
    api.post<{ success: boolean; data: ILead }>(`/leads/${id}/assign`, { salesId }),
  
  merge: (duplicateLeadId: string, targetLeadId: string) => 
    api.post<{ success: boolean; data: ILead }>('/leads/merge', { duplicateLeadId, targetLeadId }),
  
  addFollowUp: (id: string, data: { salesId: string; status: string; notes: string; nextFollowUpDate?: string }) => 
    api.post<{ success: boolean; data: IFollowUpRecord }>(`/leads/${id}/follow-up`, data)
};

export const salesApi = {
  getAll: () => 
    api.get<{ success: boolean; data: ISalesPerson[] }>('/sales'),
  
  getById: (id: string) => 
    api.get<{ success: boolean; data: ISalesPerson }>(`/sales/${id}`),
  
  create: (data: Partial<ISalesPerson>) => 
    api.post<{ success: boolean; data: ISalesPerson }>('/sales', data),
  
  update: (id: string, data: Partial<ISalesPerson>) => 
    api.put<{ success: boolean; data: ISalesPerson }>(`/sales/${id}`, data),
  
  delete: (id: string) => 
    api.delete(`/sales/${id}`)
};

export const rulesApi = {
  getAll: () => 
    api.get<{ success: boolean; data: IAssignmentRule[] }>('/rules'),
  
  create: (data: Partial<IAssignmentRule>) => 
    api.post<{ success: boolean; data: IAssignmentRule }>('/rules', data),
  
  update: (id: string, data: Partial<IAssignmentRule>) => 
    api.put<{ success: boolean; data: IAssignmentRule }>(`/rules/${id}`, data),
  
  delete: (id: string) => 
    api.delete(`/rules/${id}`)
};

export const dashboardApi = {
  getStats: () => 
    api.get<{ success: boolean; data: IDashboardStats }>('/dashboard/stats')
};

export const exportApi = {
  exportLeads: (filters?: any) => {
    const queryString = new URLSearchParams(filters || {}).toString();
    window.open(`/api/export/leads${queryString ? '?' + queryString : ''}`, '_blank');
  }
};

export default api;

import axios from 'axios';
import { Case, Lawyer, Statistics, LeadFunnel, Reassignment } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const caseApi = {
  getCases: (params?: { status?: string; case_domain?: string }) => 
    api.get<{ data: Case[]; total: number }>('/cases', { params }),
  
  getCaseById: (id: string) => 
    api.get<Case>(`/cases/${id}`),
  
  createCase: (data: Partial<Case>) => 
    api.post<Case>('/cases', data),
  
  updateCase: (id: string, data: Partial<Case>) => 
    api.put<Case>(`/cases/${id}`, data),
  
  changeStatus: (id: string, data: { new_status: string; changed_by: string; change_reason?: string }) => 
    api.post<Case>(`/cases/${id}/change-status`, data),
  
  checkConflict: (id: string, data: { opposing_party: string; checked_by: string }) => 
    api.post<{ has_conflict: boolean; result: string; details: string }>(`/cases/${id}/check-conflict`, data),
  
  getStatistics: () => 
    api.get<Statistics>('/cases/statistics'),
  
  getLeadFunnel: () => 
    api.get<LeadFunnel>('/cases/lead-funnel'),
  
  exportCases: (params?: { responsible_person?: string; start_date?: string; end_date?: string }) => 
    api.get('/cases/export', { params, responseType: 'blob' })
};

export const lawyerApi = {
  getLawyers: (params?: { status?: string; specialty?: string }) => 
    api.get<Lawyer[]>('/lawyers', { params }),
  
  createLawyer: (data: Partial<Lawyer>) => 
    api.post<Lawyer>('/lawyers', data),
  
  assignCase: (data: { case_id: string; lawyer_id: string; assigned_by: string }) => 
    api.post<Case>('/lawyers/assign', data),
  
  reassignCase: (data: { case_id: string; to_lawyer_id: string; reason: string; reassigned_by: string; follow_up_required?: boolean }) => 
    api.post<Case>('/lawyers/reassign', data),
  
  getReassignments: (params?: { case_id?: string; follow_up_required?: boolean }) => 
    api.get<Reassignment[]>('/lawyers/reassignments', { params }),
  
  completeFollowUp: (reassignmentId: string, data: { follow_up_note: string; completed_by: string }) => 
    api.post<Reassignment>(`/lawyers/reassignments/${reassignmentId}/follow-up`, data)
};

export default api;

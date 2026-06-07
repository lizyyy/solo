import axios from 'axios';
import type { CheckRecord, ExportDetail } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const checkApi = {
  getAll: (): Promise<CheckRecord[]> => 
    api.get('/checks').then(res => res.data),
  
  getById: (id: string): Promise<CheckRecord> => 
    api.get(`/checks/${id}`).then(res => res.data),
  
  import: (data: {
    sampleId: string;
    sampleName: string;
    imageUrl: string;
    caption: string;
    knowledgeRef: {
      link: string;
      title: string;
      sampleId: string;
      modelVersion: string;
      conclusion: string;
    };
    operator: string;
  }): Promise<CheckRecord> => 
    api.post('/checks/import', data).then(res => res.data),
  
  linkTicket: (id: string, data: {
    ticket: {
      ticketNo: string;
      title: string;
      content: string;
      sampleId: string;
      modelVersion: string;
      conclusion: string;
    };
    operator: string;
  }): Promise<CheckRecord> => 
    api.post(`/checks/${id}/link-ticket`, data).then(res => res.data),
  
  resolveConflict: (id: string, data: {
    conflictId: string;
    resolution: 'confirm' | 'reject';
    comment: string;
    operator: string;
  }): Promise<CheckRecord> => 
    api.post(`/checks/${id}/resolve-conflict`, data).then(res => res.data),
  
  updateReview: (id: string, data: {
    content: string;
    operator: string;
  }): Promise<CheckRecord> => 
    api.post(`/checks/${id}/update-review`, data).then(res => res.data),
  
  requestRecheck: (id: string, operator: string): Promise<CheckRecord> => 
    api.post(`/checks/${id}/request-recheck`, { operator }).then(res => res.data),
  
  completeRecheck: (id: string, operator: string): Promise<CheckRecord> => 
    api.post(`/checks/${id}/complete-recheck`, { operator }).then(res => res.data),
  
  getExportDetails: (): Promise<ExportDetail[]> => 
    api.get('/checks/export/details').then(res => res.data),
  
  createExport: (): Promise<{ exportId: string }> => 
    api.post('/checks/export').then(res => res.data),
  
  getExport: (exportId: string): Promise<ExportDetail[]> => 
    api.get(`/checks/export/${exportId}`).then(res => res.data),
  
  verifyConsistency: (): Promise<{
    isConsistent: boolean;
    details: {
      pageCount: number;
      apiCount: number;
      exportCount: number;
    };
  }> => 
    api.get('/checks/consistency/verify').then(res => res.data),
};

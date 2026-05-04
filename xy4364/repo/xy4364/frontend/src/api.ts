import axios from 'axios';
import { Batch, RiskAssessment, BatchDetail, ReviewRecord } from './types';

const API_BASE = '/api';

export const batchApi = {
  getAll: async (): Promise<Batch[]> => {
    const response = await axios.get<Batch[]>(`${API_BASE}/batches`);
    return response.data;
  },

  getById: async (id: string): Promise<BatchDetail> => {
    const response = await axios.get<BatchDetail>(`${API_BASE}/batches/${id}`);
    return response.data;
  },

  importCSV: async (file: File): Promise<{ message: string; batches: Batch[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_BASE}/import/batch`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export const temperatureCurveApi = {
  importJSON: async (file: File, batchNumber?: string): Promise<{ message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (batchNumber) {
      formData.append('batchNumber', batchNumber);
    }
    const response = await axios.post(`${API_BASE}/import/temperature-curve`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export const formulaApi = {
  importJSON: async (file: File, batchNumber?: string): Promise<{ message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (batchNumber) {
      formData.append('batchNumber', batchNumber);
    }
    const response = await axios.post(`${API_BASE}/import/formula`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export const reviewApi = {
  save: async (data: {
    batchId: string;
    reviewer: string;
    judgement: 'pass' | 'rework' | 'pending';
    notes?: string;
    reworkReason?: string;
  }): Promise<{ message: string; reviewRecord: ReviewRecord; riskAssessment: RiskAssessment }> => {
    const response = await axios.post(`${API_BASE}/review`, data);
    return response.data;
  }
};

export const riskApi = {
  getAll: async (): Promise<RiskAssessment[]> => {
    const response = await axios.get<RiskAssessment[]>(`${API_BASE}/risk-assessments`);
    return response.data;
  }
};

export const exportApi = {
  downloadReworkOrder: async (batchId: string, batchNumber: string): Promise<void> => {
    const response = await axios.get(`${API_BASE}/export/rework-order/${batchId}`, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rework-order-${batchNumber}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  downloadRiskList: async (): Promise<void> => {
    const response = await axios.get(`${API_BASE}/export/risk-list`, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'risk-list.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  downloadAuditPackage: async (batchId: string, batchNumber: string): Promise<void> => {
    const response = await axios.get(`${API_BASE}/export/audit-package/${batchId}`, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-package-${batchNumber}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
};

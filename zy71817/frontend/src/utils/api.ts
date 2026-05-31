import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

export const transactionApi = {
  getList: (period: string, status?: string, anomalyType?: string) =>
    api.get('/transactions', { params: { period, status, anomaly_type: anomalyType } }),

  getDetail: (id: number) =>
    api.get(`/transactions/${id}`),

  updateStatus: (id: number, status: string, reason: string, operator: string = '财务结算') =>
    api.put(`/transactions/${id}/status`, { status, reason, operator }),

  import: (file: File, period: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('period', period);
    return api.post('/transactions/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const anomalyApi = {
  resolve: (id: number, resolutionNote: string, operator: string = '财务结算') =>
    api.put(`/anomalies/${id}/resolve`, { resolution_note: resolutionNote, operator }),

  detect: (period: string) =>
    api.post('/anomalies/detect', { period })
};

export const reconciliationApi = {
  getSummary: (period: string) =>
    api.get(`/reconciliation/${period}`)
};

export const exportApi = {
  download: (period: string, type: 'all' | 'anomalies' | 'reconciliation') => {
    const url = `/api/export/${period}?type=${type}`;
    window.open(url, '_blank');
  }
};

export const sampleApi = {
  generate: (period: string) =>
    api.post('/sample-data', { period })
};

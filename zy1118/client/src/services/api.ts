import axios from 'axios';
import type {
  Plan,
  Hall,
  Booth,
  FlowZone,
  PowerZone,
  ValidationResult,
  PlanComparison,
  LayoutReport,
  ReportFormat
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const planApi = {
  async getAll(): Promise<Plan[]> {
    const response = await api.get('/plans');
    return response.data.data;
  },

  async getById(id: string): Promise<Plan> {
    const response = await api.get(`/plans/${id}`);
    return response.data.data;
  },

  async create(data: {
    name: string;
    description?: string;
    hall: Hall;
    booths?: Booth[];
    flowZones?: FlowZone[];
    powerZones?: PowerZone[];
  }): Promise<Plan> {
    const response = await api.post('/plans', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    hall: Hall;
    booths: Booth[];
    flowZones: FlowZone[];
    powerZones: PowerZone[];
  }>): Promise<Plan> {
    const response = await api.put(`/plans/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/plans/${id}`);
  },

  async validate(id: string): Promise<ValidationResult[]> {
    const response = await api.get(`/plans/${id}/validate`);
    return response.data.data.results;
  },

  async compare(planAId: string, planBId: string): Promise<PlanComparison> {
    const response = await api.get(`/plans/compare/${planAId}/${planBId}`);
    return response.data.data;
  },

  async getReport(id: string, format: 'json'): Promise<LayoutReport>;
  async getReport(id: string, format: 'markdown' | 'html'): Promise<string>;
  async getReport(id: string, format: ReportFormat): Promise<LayoutReport | string> {
    const response = await api.get(`/plans/${id}/report`, {
      params: { format },
      responseType: format === 'json' ? 'json' : 'text'
    });
    
    if (format === 'json') {
      return response.data.data;
    }
    return response.data;
  }
};

export const importApi = {
  async importHall(file: File): Promise<Hall> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/hall', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  },

  async importBooths(file: File): Promise<Booth[]> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/booths', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  },

  async importFlow(file: File): Promise<FlowZone[]> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/flow', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  },

  async importPowerZones(file: File): Promise<PowerZone[]> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/import/power-zones', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  }
};

export default api;

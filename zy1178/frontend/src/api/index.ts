import axios from 'axios';
import {
  Project,
  Roof,
  Obstacle,
  Panel,
  HourlyData,
  Layout,
  CalculationResult,
  Point,
} from '../types';

const API_BASE_URL = '/api';

export const projectApi = {
  getAll: () => axios.get<Project[]>(`${API_BASE_URL}/projects/`),
  getById: (id: number) => axios.get<Project>(`${API_BASE_URL}/projects/${id}`),
  create: (data: { name: string; description?: string; location?: string; latitude?: number; longitude?: number }) =>
    axios.post<Project>(`${API_BASE_URL}/projects/`, data),
  update: (id: number, data: Partial<Project>) =>
    axios.put<Project>(`${API_BASE_URL}/projects/${id}`, data),
  delete: (id: number) => axios.delete(`${API_BASE_URL}/projects/${id}`),
};

export const roofApi = {
  getByProject: (projectId: number) =>
    axios.get<Roof[]>(`${API_BASE_URL}/projects/${projectId}/roofs/`),
  create: (data: { project_id: number; name?: string; coordinates: Point[]; area: number; inclination?: number; azimuth?: number }) =>
    axios.post<Roof>(`${API_BASE_URL}/projects/roofs/`, data),
};

export const obstacleApi = {
  getByProject: (projectId: number) =>
    axios.get<Obstacle[]>(`${API_BASE_URL}/projects/${projectId}/obstacles/`),
  create: (data: { project_id: number; name?: string; coordinates: Point[]; height: number; type?: string }) =>
    axios.post<Obstacle>(`${API_BASE_URL}/projects/obstacles/`, data),
};

export const panelApi = {
  getByProject: (projectId: number) =>
    axios.get<Panel[]>(`${API_BASE_URL}/projects/${projectId}/panels/`),
  create: (data: {
    project_id: number;
    model?: string;
    power: number;
    efficiency: number;
    width: number;
    height: number;
    temperature_coefficient?: number;
    lifetime?: number;
    degradation_rate?: number;
  }) => axios.post<Panel>(`${API_BASE_URL}/projects/panels/`, data),
};

export const hourlyDataApi = {
  getByProject: (projectId: number, limit?: number) =>
    axios.get<HourlyData[]>(`${API_BASE_URL}/projects/${projectId}/hourly-data/`, {
      params: limit ? { limit } : {},
    }),
  importCsv: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API_BASE_URL}/projects/hourly-data/csv/?project_id=${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const layoutApi = {
  getByProject: (projectId: number) =>
    axios.get<Layout[]>(`${API_BASE_URL}/projects/${projectId}/layouts/`),
  create: (data: {
    project_id: number;
    name?: string;
    panel_positions: Array<{ x: number; y: number }>;
    panel_count: number;
    total_power: number;
    is_active?: boolean;
  }) => axios.post<Layout>(`${API_BASE_URL}/projects/layouts/`, data),
  activate: (layoutId: number) =>
    axios.put(`${API_BASE_URL}/projects/layouts/${layoutId}/activate`),
};

export const calculationApi = {
  run: (data: { project_id: number; layout_id: number; investment_per_kw?: number; discount_rate?: number }) =>
    axios.post<CalculationResult>(`${API_BASE_URL}/calculations/run`, data),
  getByResultId: (resultId: number) =>
    axios.get<CalculationResult>(`${API_BASE_URL}/calculations/results/${resultId}`),
  getByProject: (projectId: number) =>
    axios.get<CalculationResult[]>(`${API_BASE_URL}/calculations/project/${projectId}/results`),
};

export const exportApi = {
  exportReport: (data: { project_id: number; layout_ids: number[]; format?: 'markdown' | 'json'; include_charts?: boolean }) =>
    axios.post(`${API_BASE_URL}/exports/report`, data, {
    responseType: 'blob',
  }),
};

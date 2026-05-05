import axios, { AxiosInstance } from 'axios';
import {
  Project,
  ProjectListItem,
  CalculationResult,
  ApiResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getProjects(): Promise<ProjectListItem[]> {
    const response = await this.client.get<ApiResponse<ProjectListItem[]>>('/projects');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '获取项目列表失败');
  }

  async getProject(id: string): Promise<Project> {
    const response = await this.client.get<ApiResponse<Project>>(`/projects/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '获取项目失败');
  }

  async createProject(name: string, description?: string): Promise<Project> {
    const response = await this.client.post<ApiResponse<Project>>('/projects', {
      name,
      description,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '创建项目失败');
  }

  async createSampleProject(): Promise<Project> {
    const response = await this.client.post<ApiResponse<Project>>('/projects/sample');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '创建示例项目失败');
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const response = await this.client.put<ApiResponse<Project>>(`/projects/${id}`, updates);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '更新项目失败');
  }

  async deleteProject(id: string): Promise<void> {
    const response = await this.client.delete<ApiResponse<void>>(`/projects/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.message || '删除项目失败');
    }
  }

  async importData(file: File, projectId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('projectId', projectId);
    }

    const response = await this.client.post<ApiResponse<any>>('/projects/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.data.success) {
      throw new Error(response.data.message || '导入数据失败');
    }

    return response.data;
  }

  async calculate(projectId: string): Promise<CalculationResult> {
    const response = await this.client.post<ApiResponse<CalculationResult>>(
      `/projects/${projectId}/calculate`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '计算失败');
  }

  async updateValve(projectId: string, valveId: string, opening: number, notes?: string): Promise<any> {
    const response = await this.client.put<ApiResponse<any>>(
      `/projects/${projectId}/valves/${valveId}`,
      { opening, notes }
    );
    if (!response.data.success) {
      throw new Error(response.data.message || '更新阀门失败');
    }
    return response.data.data;
  }

  async saveUserNotes(projectId: string, notes: string): Promise<void> {
    const response = await this.client.put<ApiResponse<void>>(
      `/projects/${projectId}/notes`,
      { notes }
    );
    if (!response.data.success) {
      throw new Error(response.data.message || '保存备注失败');
    }
  }

  async exportMarkdown(projectId: string): Promise<Blob> {
    const response = await this.client.get(`/projects/${projectId}/export/markdown`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async exportJSON(projectId: string): Promise<Blob> {
    const response = await this.client.get(`/projects/${projectId}/export/json`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadTemplate(): Promise<Blob> {
    const response = await this.client.get('/projects/template', {
      responseType: 'blob',
    });
    return response.data;
  }

  async getCalculationHistory(projectId: string): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>(
      `/projects/${projectId}/history`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '获取计算历史失败');
  }
}

export const apiService = new ApiService();

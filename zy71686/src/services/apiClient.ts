import type {
  ImportRequest,
  ImportResponse,
  ImportPreviewResponse,
  ImportBatch,
  DataImportWarning,
  RiskAnalysisRequest,
  RiskAnalysisResponse,
  RiskAnalysisResult,
  GraphRequest,
  GraphResponse,
  DashboardStats,
  VersionSnapshot,
  OperationLog,
  RollbackRequest,
  RollbackResponse,
  ReportRequest,
  ReportResponse,
  BatchTask
} from '../../shared/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private operator = 'system';

  setOperator(operator: string) {
    this.operator = operator;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers = {
      'Content-Type': 'application/json',
      'x-operator': this.operator,
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络请求失败',
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const queryString = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  async download(endpoint: string): Promise<Response | null> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'x-operator': this.operator,
        },
      });
      if (!response.ok) return null;
      return response;
    } catch (error) {
      console.error(`Download failed: ${endpoint}`, error);
      return null;
    }
  }
}

export const apiClient = new ApiClient();

export const importApi = {
  preview: (data: ImportRequest) =>
    apiClient.post<ImportPreviewResponse>('/import/preview', data),
  execute: (data: ImportRequest) =>
    apiClient.post<ImportResponse>('/import/execute', data),
  getBatch: (batchId: string) =>
    apiClient.get<ImportBatch>(`/import/batches/${batchId}`),
  listBatches: (limit = 20) =>
    apiClient.get<ImportBatch[]>('/import/batches', { limit }),
  getBatchWarnings: (batchId: string) =>
    apiClient.get<DataImportWarning[]>(`/import/batches/${batchId}/warnings`),
  getTask: (taskId: string) =>
    apiClient.get<BatchTask>(`/import/tasks/${taskId}`),
};

export const riskApi = {
  analyze: (data: RiskAnalysisRequest) =>
    apiClient.post<RiskAnalysisResponse>('/risk/analyze', data),
  getResults: (version?: string, riskLevel?: string) =>
    apiClient.get<RiskAnalysisResult[]>('/risk/results', { version, riskLevel }),
  getResultByCustomer: (customerId: string, version?: string) =>
    apiClient.get<RiskAnalysisResult>(`/risk/results/customer/${customerId}`, { version }),
  getGraph: (params: Partial<GraphRequest>) =>
    apiClient.get<GraphResponse>('/risk/graph', params),
  getDashboard: () =>
    apiClient.get<DashboardStats>('/risk/dashboard'),
  getTask: (taskId: string) =>
    apiClient.get<BatchTask>(`/risk/tasks/${taskId}`),
};

export const versionApi = {
  listSnapshots: (limit = 50) =>
    apiClient.get<VersionSnapshot[]>('/version/snapshots', { limit }),
  getActiveSnapshot: () =>
    apiClient.get<VersionSnapshot>('/version/snapshots/active'),
  getSnapshot: (snapshotId: string) =>
    apiClient.get<VersionSnapshot>(`/version/snapshots/${snapshotId}`),
  setActiveSnapshot: (snapshotId: string) =>
    apiClient.put<VersionSnapshot>(`/version/snapshots/${snapshotId}/activate`),
  createSnapshot: (data: { name: string; description?: string }) =>
    apiClient.post<VersionSnapshot>('/version/snapshots', data),
  rollback: (data: RollbackRequest) =>
    apiClient.post<RollbackResponse>('/version/rollback', data),
  undoOperation: (logId: string) =>
    apiClient.post<VersionSnapshot>(`/version/undo/${logId}`),
  listLogs: (limit = 100) =>
    apiClient.get<OperationLog[]>('/version/logs', { limit }),
  compare: (snapshotId1: string, snapshotId2: string) =>
    apiClient.get<any>(`/version/compare/${snapshotId1}/${snapshotId2}`),
};

export const reportApi = {
  generate: (data: ReportRequest) =>
    apiClient.post<ReportResponse>('/report/generate', data),
  download: (reportId: string) =>
    apiClient.download(`/report/download/${reportId}`),
  getTask: (taskId: string) =>
    apiClient.get<BatchTask>(`/report/tasks/${taskId}`),
};

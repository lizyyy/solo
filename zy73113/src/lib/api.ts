import type { 
  Plan, PlanDetail, PlanStatus, UpdateRemarkRequest, 
  UpdateJudgmentRequest, AddMaterialRequest, UpdateStatusRequest, ApiResponse 
} from '../../shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json() as ApiResponse<T>;
  
  if (data.code !== 0) {
    throw new Error(data.message);
  }

  return data.data;
}

export const api = {
  getPlans: (params?: { status?: PlanStatus; keyword?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.keyword) searchParams.append('keyword', params.keyword);
    const query = searchParams.toString();
    return request<Plan[]>(`/plans${query ? `?${query}` : ''}`);
  },

  getPlanDetail: (id: string) => {
    return request<PlanDetail>(`/plans/${id}`);
  },

  updateRemark: (id: string, data: UpdateRemarkRequest) => {
    return request<Plan>(`/plans/${id}/remark`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateJudgment: (id: string, data: UpdateJudgmentRequest) => {
    return request<Plan>(`/plans/${id}/judgment`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateStatus: (id: string, data: UpdateStatusRequest) => {
    return request<Plan>(`/plans/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  addMaterial: (id: string, data: AddMaterialRequest) => {
    return request<Plan>(`/plans/${id}/material`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  exportPlan: (id: string, format: 'json' | 'csv' = 'json') => {
    window.open(`${API_BASE}/plans/${id}/export?format=${format}`, '_blank');
  },
};

import type {
  SchemeComparisonRecord,
  ViewPoint,
  AddMaterialPayload,
  ExportResult,
} from '@/shared/types';

const BASE_URL = import.meta.env.VITE_API_BASE || '';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}/api${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API Error ${response.status}: ${errorText || response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      if (
        json &&
        typeof json === 'object' &&
        'success' in json &&
        'data' in json &&
        json.success === true
      ) {
        return json.data as T;
      }
      if (json && typeof json === 'object' && json.success === false) {
        throw new Error(
          `API 业务错误: ${(json as any).error || JSON.stringify(json)}`
        );
      }
      return json as T;
    }
    return (await response.text()) as unknown as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
  }
}

// ---------- 后端请求体字段名（严格对应 TECH §4 REST 定义） ----------

interface ReplaceScreenshotReq {
  image_url: string;
  append_to_history: boolean;
  operator: string;
}

interface ResolvePendingReq {
  keep_collision_id?: string;
  resolution: string;
  operator: string;
}

interface ReviseConclusionReq {
  new_conclusion: import('@/shared/types').Conclusion;
  revise_reason: string;
  new_confidence?: number;
  extra_remarks?: Array<{ content: string; operator: string }>;
  operator: string;
}

export const api = {
  getRecords: () =>
    request<SchemeComparisonRecord[]>('/records'),

  getRecord: (id: string) =>
    request<SchemeComparisonRecord>(`/records/${id}`),

  createRecord: (data: {
    project_name: string;
    project_code: string;
    structural_element: string;
    operator: string;
  }) =>
    request<SchemeComparisonRecord>('/records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateViewpoint: (id: string, viewpoint: ViewPoint, operator: string) =>
    request<SchemeComparisonRecord>(`/records/${id}/viewpoint`, {
      method: 'PUT',
      body: JSON.stringify({ viewpoint, operator }),
    }),

  addMaterial: (
    id: string,
    payload: AddMaterialPayload & { operator: string }
  ) =>
    request<SchemeComparisonRecord>(`/records/${id}/materials`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  addRemark: (
    id: string,
    itemId: string,
    content: string,
    operator: string
  ) =>
    request<SchemeComparisonRecord>(
      `/records/${id}/materials/${itemId}/remarks`,
      {
        method: 'POST',
        body: JSON.stringify({ content, operator }),
      }
    ),

  replaceScreenshot: (
    id: string,
    itemId: string,
    colId: string,
    payload: ReplaceScreenshotReq
  ) =>
    request<SchemeComparisonRecord>(
      `/records/${id}/materials/${itemId}/collisions/${colId}/screenshot`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  resolvePending: (
    id: string,
    pendingId: string,
    payload: ResolvePendingReq
  ) =>
    request<SchemeComparisonRecord>(
      `/records/${id}/pending/${pendingId}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  reviseConclusion: (
    id: string,
    payload: ReviseConclusionReq
  ) =>
    request<SchemeComparisonRecord>(`/records/${id}/revise`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exportRecord: (id: string) =>
    request<ExportResult>(`/records/${id}/export`),

  getAuditLog: (
    id: string,
    params?: { operator?: string; op_type?: string; keyword?: string }
  ) => {
    const query = new URLSearchParams();
    if (params?.operator) query.set('operator', params.operator);
    if (params?.op_type) query.set('op_type', params.op_type);
    if (params?.keyword) query.set('keyword', params.keyword);
    const queryStr = query.toString();
    return request<any>(
      `/records/${id}/audit${queryStr ? `?${queryStr}` : ''}`
    );
  },
};

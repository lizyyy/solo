import type {
  Clip,
  ClipStatus,
  CreateClipRequest,
  UpdateClipRequest,
  UpdateStatusRequest,
  AddMaterialRequest,
  Material,
  ChangeLog,
  ExportManifest,
  User,
} from 'shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  clips: {
    list: (filters?: { status?: ClipStatus; keyword?: string }): Promise<Clip[]> => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.keyword) params.set('keyword', filters.keyword);
      const query = params.toString();
      return request<Clip[]>(`/clips${query ? `?${query}` : ''}`);
    },

    get: (id: string): Promise<Clip> => request<Clip>(`/clips/${id}`),

    create: (data: CreateClipRequest): Promise<Clip> =>
      request<Clip>('/clips', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateClipRequest): Promise<Clip> =>
      request<Clip>(`/clips/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    updateStatus: (id: string, data: UpdateStatusRequest): Promise<Clip> =>
      request<Clip>(`/clips/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    changeLogs: (id: string): Promise<ChangeLog[]> => request<ChangeLog[]>(`/clips/${id}/changelogs`),

    materials: (id: string): Promise<Material[]> => request<Material[]>(`/clips/${id}/materials`),

    addMaterial: (id: string, data: AddMaterialRequest): Promise<Material> =>
      request<Material>(`/clips/${id}/materials`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  export: {
    check: (clipIds: string[], operatorId: string): Promise<ExportManifest> => {
      const params = new URLSearchParams();
      params.set('clipIds', clipIds.join(','));
      params.set('operatorId', operatorId);
      return request<ExportManifest>(`/export/check?${params.toString()}`);
    },

    create: (clipIds: string[], operatorId: string): Promise<{ url: string; manifest: ExportManifest }> =>
      request<{ url: string; manifest: ExportManifest }>('/export', {
        method: 'POST',
        body: JSON.stringify({ clipIds, operatorId }),
      }),
  },

  users: {
    list: (): Promise<User[]> => request<User[]>('/users'),
  },
};

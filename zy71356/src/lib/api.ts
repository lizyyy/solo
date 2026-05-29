import {
  Vendor,
  Stall,
  Arrangement,
  ArrangementWithDetails,
  Assignment,
  AssignmentWithDetails,
  SwapLog,
  Conflict,
  ImportError,
} from '@shared/types';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  vendors: {
    getAll: () => request<Vendor[]>('/api/vendors'),
    getById: (id: string) => request<Vendor>(`/api/vendors/${id}`),
    create: (data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>) =>
      request<Vendor>('/api/vendors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Vendor>) =>
      request<Vendor>(`/api/vendors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/vendors/${id}`, {
        method: 'DELETE',
      }),
    bulkImport: (data: Array<Partial<Vendor>>, source?: string) =>
      request<{ success: number; errors: ImportError[]; imported: Vendor[] }>(
        '/api/vendors/bulk',
        {
          method: 'POST',
          body: JSON.stringify({ data, source }),
        }
      ),
  },

  stalls: {
    getAll: () => request<Stall[]>('/api/stalls'),
    getById: (id: string) => request<Stall>(`/api/stalls/${id}`),
    getEntrance: () => request<Stall[]>('/api/stalls/entrance'),
    getDimensions: () =>
      request<{ maxRow: number; maxCol: number }>('/api/stalls/dimensions'),
    create: (data: Omit<Stall, 'id'>) =>
      request<Stall>('/api/stalls', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Stall>) =>
      request<Stall>(`/api/stalls/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/stalls/${id}`, {
        method: 'DELETE',
      }),
    replaceGrid: (stalls: Array<Omit<Stall, 'id'>>) =>
      request<{ success: boolean; count: number }>('/api/stalls/replace-grid', {
        method: 'POST',
        body: JSON.stringify({ stalls }),
      }),
    bulkImport: (data: Array<Partial<Stall>>, source?: string) =>
      request<{ success: number; errors: ImportError[]; imported: Stall[] }>(
        '/api/stalls/bulk',
        {
          method: 'POST',
          body: JSON.stringify({ data, source }),
        }
      ),
  },

  arrangements: {
    getAll: () => request<Arrangement[]>('/api/arrangements'),
    getLatest: () =>
      request<ArrangementWithDetails>('/api/arrangements/latest'),
    getById: (id: string) =>
      request<ArrangementWithDetails>(`/api/arrangements/${id}`),
    getAssignments: (id: string) =>
      request<AssignmentWithDetails[]>(`/api/arrangements/${id}/assignments`),
    getConflicts: (id: string) =>
      request<Conflict[]>(`/api/arrangements/${id}/conflicts`),
    getSwapLogs: (id: string) =>
      request<SwapLog[]>(`/api/arrangements/${id}/swap-logs`),
    create: (data: Omit<Arrangement, 'id' | 'createdAt'>) =>
      request<Arrangement>('/api/arrangements', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Arrangement>) =>
      request<Arrangement>(`/api/arrangements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    assign: (
      id: string,
      stallId: string,
      vendorId: string,
      source?: string
    ) =>
      request<Assignment>(`/api/arrangements/${id}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ stallId, vendorId, source }),
      }),
    removeAssignment: (id: string, stallId: string) =>
      request<{ success: boolean }>(
        `/api/arrangements/${id}/assign/${stallId}`,
        {
          method: 'DELETE',
        }
      ),
    swap: (
      id: string,
      stallA: string,
      stallB: string,
      reason?: string,
      operator?: string
    ) =>
      request<{ success: boolean; message?: string }>(
        `/api/arrangements/${id}/swap`,
        {
          method: 'POST',
          body: JSON.stringify({ stallA, stallB, reason, operator }),
        }
      ),
    createVersion: (
      id: string,
      newVersion: string,
      name: string,
      createdBy: string,
      note?: string
    ) =>
      request<ArrangementWithDetails>(`/api/arrangements/${id}/version`, {
        method: 'POST',
        body: JSON.stringify({ newVersion, name, createdBy, note }),
      }),
  },

  export: {
    excel: (id: string) => {
      window.open(`/api/export/excel/${id}`, '_blank');
    },
    conflictReport: (id: string) => {
      window.open(`/api/export/conflict-report/${id}`, '_blank');
    },
    getConflictReportText: (id: string) =>
      request<{ report: string }>(`/api/export/conflict-report-text/${id}`),
  },
};

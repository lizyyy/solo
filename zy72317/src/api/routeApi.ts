import apiClient from './client';
import type {
  PickingRoute,
  ChangeRecord,
  SupplementRouteRequest,
  RecalculateRequest,
} from '../../shared/types';

export const routeApi = {
  getRoutes: (includeDeleted: boolean = false) => {
    return apiClient.get<PickingRoute[]>('/routes', {
      params: { includeDeleted },
    });
  },

  getRouteById: (id: string) => {
    return apiClient.get<PickingRoute>(`/routes/${id}`);
  },

  deleteRoute: (id: string, operator: string) => {
    return apiClient.delete<PickingRoute>(`/routes/${id}`, {
      data: { operator },
    });
  },

  supplementRoute: (data: SupplementRouteRequest) => {
    return apiClient.post<PickingRoute>('/routes', data);
  },

  recalculate: (data: RecalculateRequest) => {
    return apiClient.post<{ updated: number; message: string }>('/routes/recalculate', data);
  },

  detectGaps: (operator: string) => {
    return apiClient.post<{ gapCount: number; gaps: any[] }>('/routes/detect-gaps', { operator });
  },

  getRouteChanges: (routeId: string) => {
    return apiClient.get<ChangeRecord[]>(`/routes/${routeId}/changes`);
  },

  exportRoutes: () => {
    return apiClient.get('/routes/export', {
      responseType: 'blob',
    });
  },
};

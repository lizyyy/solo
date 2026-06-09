import apiClient from './client';
import type {
  PickingRoute,
  ChangeRecord,
  SupplementRouteRequest,
  RecalculateRequest,
  GapReviewRequest,
  GapReviewResponse,
  GapRecord,
} from '../../shared/types';

interface RoutesResponse {
  routes: PickingRoute[];
  openGaps: GapRecord[];
  openGapCount: number;
}

interface GapListResponse {
  gaps: GapRecord[];
  count: number;
}

export const routeApi = {
  getRoutes: (includeDeleted: boolean = false) => {
    return apiClient.get<RoutesResponse>('/routes', {
      params: { includeDeleted },
    });
  },

  getRouteById: (id: string) => {
    return apiClient.get<PickingRoute>(`/routes/${id}`);
  },

  deleteRoute: (id: string, operator: string) => {
    return apiClient.delete<RoutesResponse>(`/routes/${id}`, {
      data: { operator },
    });
  },

  supplementRoute: (data: SupplementRouteRequest) => {
    return apiClient.post<RoutesResponse>('/routes', data);
  },

  recalculate: (data: RecalculateRequest) => {
    return apiClient.post<RoutesResponse & { updated: number; message: string }>('/routes/recalculate', data);
  },

  detectGaps: (operator: string) => {
    return apiClient.post<{ gapCount: number; openGapCount: number; gaps: any[] }>('/routes/detect-gaps', { operator });
  },

  getOpenGaps: () => {
    return apiClient.get<GapListResponse>('/routes/gaps/open');
  },

  getAllGaps: (status: 'open' | 'reviewed' | 'all' = 'all') => {
    return apiClient.get<GapListResponse>('/routes/gaps', {
      params: { status },
    });
  },

  reviewGap: (data: GapReviewRequest) => {
    return apiClient.post<GapReviewResponse & { openGaps: GapRecord[]; openGapCount: number }>('/routes/gaps/review', data);
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

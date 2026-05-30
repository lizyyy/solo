import type {
  Track,
  Vote,
  Copyright,
  Decision,
  AuditLog,
  BadDataRecord,
  Stats,
  FilterCriteria,
  TrackWithRelations,
  ImportResult,
} from '../types/index.js';

const baseURL = 'http://localhost:3001/api';

interface RequestOptions {
  body?: any;
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers = {}, params } = options;

  let url = `${baseURL}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const defaultHeaders: Record<string, string> = {
    'x-operator': 'local-admin',
  };

  if (!(body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const data = (await response.json()) as ApiResponse<T>;

    if (!data.success) {
      throw new Error(data.error || '请求失败');
    }

    return data.data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('网络请求失败，请稍后重试');
  }
}

export const tracks = {
  getTracks: (params?: { searchKeyword?: string }): Promise<TrackWithRelations[]> =>
    request('GET', '/tracks', { params }),

  getTrack: (id: string): Promise<TrackWithRelations> =>
    request('GET', `/tracks/${id}`),

  createTrack: (data: Omit<Track, 'id' | 'createdAt' | 'updatedAt' | 'source'>): Promise<Track> =>
    request('POST', '/tracks', { body: data }),

  updateTrack: (id: string, data: Partial<Omit<Track, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Track> =>
    request('PUT', `/tracks/${id}`, { body: data }),

  deleteTrack: (id: string): Promise<void> =>
    request('DELETE', `/tracks/${id}`),
};

export const votes = {
  getVotes: (): Promise<Vote[]> =>
    request('GET', '/votes'),

  getVotesByTrack: (trackId: string): Promise<Vote[]> =>
    request('GET', `/votes/track/${trackId}`),

  importVotes: (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('POST', '/import/votes', { body: formData });
  },
};

export const copyright = {
  getCopyrights: (): Promise<Copyright[]> =>
    request('GET', '/copyright'),

  getCopyrightByTrack: (trackId: string): Promise<Copyright> =>
    request('GET', `/copyright/track/${trackId}`),

  importCopyrights: (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('POST', '/import/copyright', { body: formData });
  },
};

export const decisions = {
  getDecisions: (): Promise<Decision[]> =>
    request('GET', '/decisions'),

  getDecision: (id: string): Promise<Decision> =>
    request('GET', `/decisions/${id}`),

  createDecision: (data: {
    name: string;
    selectedTrackIds: string[];
    filters: FilterCriteria;
    deduplicationRules: { field: 'voterId' | 'voterName' | 'trackName'; enabled: boolean }[];
    decisionReason?: string;
  }): Promise<Decision> =>
    request('POST', '/decisions', { body: data }),

  toggleTrack: (decisionId: string, trackId: string): Promise<Decision> =>
    request('POST', `/decisions/${decisionId}/toggle-track`, { body: { trackId } }),

  exportDecision: (id: string): Promise<Blob> =>
    request('GET', `/decisions/${id}/export`),
};

export const audit = {
  getAuditLogs: (): Promise<AuditLog[]> =>
    request('GET', '/audit/logs'),
};

export const badData = {
  getBadData: (): Promise<BadDataRecord[]> =>
    request('GET', '/bad-data'),
};

export const stats = {
  getStats: (selectedIds: string[], decisionId?: string): Promise<Stats> =>
    request('GET', '/stats', {
      params: {
        selectedIds: selectedIds.join(','),
        decisionId,
      },
    }),
};

export { request };

import type { TrackCleanupRecord, VersionHistory, FilterState } from '../../shared/types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export async function getRecords(filters?: FilterState): Promise<TrackCleanupRecord[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });
  }
  const queryString = params.toString();
  return request<TrackCleanupRecord[]>(`/records${queryString ? `?${queryString}` : ''}`);
}

export async function getRecord(id: string): Promise<TrackCleanupRecord> {
  return request<TrackCleanupRecord>(`/records/${id}`);
}

export async function getRecordVersions(id: string): Promise<VersionHistory[]> {
  return request<VersionHistory[]>(`/records/${id}/versions`);
}

export async function updateRecord(
  id: string,
  updates: Partial<TrackCleanupRecord> & { modifiedBy?: string }
): Promise<TrackCleanupRecord> {
  return request<TrackCleanupRecord>(`/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function supplementRecord(
  id: string,
  oldChannelInfo: string,
  modifiedBy: string = '小孟'
): Promise<TrackCleanupRecord> {
  return request<TrackCleanupRecord>(`/records/${id}/supplement`, {
    method: 'POST',
    body: JSON.stringify({ oldChannelInfo, modifiedBy }),
  });
}

export async function exportRecordsCsv(filters?: FilterState): Promise<void> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });
  }
  const queryString = params.toString();
  const url = `${API_BASE}/export/csv${queryString ? `?${queryString}` : ''}`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `编曲工程轨道清理清单_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function getExportPreview(filters?: FilterState): Promise<TrackCleanupRecord[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });
  }
  const queryString = params.toString();
  return request<TrackCleanupRecord[]>(`/export/preview${queryString ? `?${queryString}` : ''}`);
}

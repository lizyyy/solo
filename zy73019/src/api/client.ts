import type { Track, TimelineNode, Material } from '../../shared/types';

const BASE_URL = '/api';

interface ApiResponse<T> {
  data: T;
}

interface ListTracksParams {
  search?: string;
  status?: string;
  sortBy?: string;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  return res.json() as Promise<{ data: T }>;
}

export function listTracks(params?: ListTracksParams): Promise<{ data: Track[] }> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return request<Track[]>(`/tracks${query}`);
}

export function getTrack(id: string): Promise<{ data: Track }> {
  return request<Track>(`/tracks/${id}`);
}

export function createTrack(payload: any): Promise<{ data: Track }> {
  return request<Track>('/tracks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function reviseTrack(id: string, payload: any): Promise<{ data: Track }> {
  return request<Track>(`/tracks/${id}/revise`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getTimeline(id: string): Promise<{ data: TimelineNode[] }> {
  return request<TimelineNode[]>(`/tracks/${id}/timeline`);
}

export function getHandoff(id: string): Promise<{ data: string }> {
  return request<string>(`/tracks/${id}/handoff`);
}

export async function uploadMaterial(
  id: string,
  formData: FormData
): Promise<{ data: Material }> {
  const res = await fetch(`${BASE_URL}/tracks/${id}/materials`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  return res.json() as Promise<{ data: Material }>;
}

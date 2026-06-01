import type { PersistedState, CameraState, Filters, UserMarker } from '../data/types';

const STORAGE_KEY = 'sunlight-sandbox-state';

export const defaultFilters: Filters = {
  district: [],
  floors: [1, 100],
  sunlightHours: [0, 24],
  anomalyType: [],
};

export const defaultCameraState: CameraState = {
  position: [0, 40, 50],
  target: [0, 0, 0],
};

export const defaultUserMarkers: Record<string, UserMarker> = {};

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.lastSaved) return null;
    return parsed;
  } catch (e) {
    console.warn('Failed to load persisted state:', e);
    return null;
  }
}

export function savePersistedState(state: {
  userMarkers: Record<string, UserMarker>;
  cameraState: CameraState;
  filters: Filters;
  currentHour: number;
}): void {
  try {
    const persisted: PersistedState = {
      ...state,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (e) {
    console.warn('Failed to save persisted state:', e);
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear persisted state:', e);
  }
}

export function formatFilterSummary(filters: Filters): string {
  const parts: string[] = [];
  if (filters.district.length > 0) {
    parts.push(`区域:${filters.district.join(',')}`);
  }
  if (filters.floors[0] > 1 || filters.floors[1] < 100) {
    parts.push(`楼层:${filters.floors[0]}-${filters.floors[1]}`);
  }
  if (filters.sunlightHours[0] > 0 || filters.sunlightHours[1] < 24) {
    parts.push(`日照:${filters.sunlightHours[0]}-${filters.sunlightHours[1]}h`);
  }
  if (filters.anomalyType.length > 0) {
    parts.push(`异常:${filters.anomalyType.length}种`);
  }
  return parts.length > 0 ? parts.join(' | ') : '无筛选';
}

export function formatTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

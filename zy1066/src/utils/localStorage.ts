import { ProjectData, WallConfig, Route, UserProfile, ViewMode } from '../types';
import { createSampleWall, createSampleRoutes, DEFAULT_USER_PROFILE } from '../data/sampleData';

const STORAGE_KEY = 'climbing-route-planner-data';

export function getInitialData(): ProjectData {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.walls && parsed.walls.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to default
    }
  }
  
  const sampleWall = createSampleWall();
  const sampleRoutes = createSampleRoutes(sampleWall.id);
  
  return {
    walls: [sampleWall],
    routes: sampleRoutes,
    activeWallId: sampleWall.id,
    activeRouteId: sampleRoutes[0]?.id || null,
    userProfile: DEFAULT_USER_PROFILE,
    viewMode: '2d',
  };
}

export function saveData(data: ProjectData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportAsJSON(data: ProjectData): string {
  return JSON.stringify(data, null, 2);
}

export function importFromJSON(jsonString: string): ProjectData | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (
      Array.isArray(parsed.walls) && Array.isArray(parsed.routes)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function downloadJSON(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import type { StudentWork, ScreeningSession, FilterCriteria, PortfolioScore, Anomaly } from '../types';

const STORAGE_KEYS = {
  WORKS: 'portfolio_works',
  SESSIONS: 'portfolio_sessions',
  CURRENT_CRITERIA: 'portfolio_criteria',
  SELECTED_IDS: 'portfolio_selected'
};

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return defaultValue;
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to remove from localStorage:', e);
  }
}

export function saveWorks(works: StudentWork[]): void {
  saveToStorage(STORAGE_KEYS.WORKS, works);
}

export function loadWorks(): StudentWork[] {
  return loadFromStorage<StudentWork[]>(STORAGE_KEYS.WORKS, []);
}

export function saveSessions(sessions: ScreeningSession[]): void {
  saveToStorage(STORAGE_KEYS.SESSIONS, sessions);
}

export function loadSessions(): ScreeningSession[] {
  return loadFromStorage<ScreeningSession[]>(STORAGE_KEYS.SESSIONS, []);
}

export function saveCriteria(criteria: FilterCriteria): void {
  saveToStorage(STORAGE_KEYS.CURRENT_CRITERIA, criteria);
}

export function loadCriteria(): FilterCriteria | null {
  return loadFromStorage<FilterCriteria | null>(STORAGE_KEYS.CURRENT_CRITERIA, null);
}

export function saveSelectedIds(ids: string[]): void {
  saveToStorage(STORAGE_KEYS.SELECTED_IDS, ids);
}

export function loadSelectedIds(): string[] {
  return loadFromStorage<string[]>(STORAGE_KEYS.SELECTED_IDS, []);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createSession(
  name: string,
  note: string,
  criteria: FilterCriteria,
  selectedWorkIds: string[],
  score: PortfolioScore,
  anomalies: Anomaly[]
): ScreeningSession {
  return {
    id: generateId(),
    name,
    criteria: { ...criteria },
    selectedWorkIds: [...selectedWorkIds],
    score: JSON.parse(JSON.stringify(score)),
    anomalies: JSON.parse(JSON.stringify(anomalies)),
    createdAt: new Date().toISOString(),
    note
  };
}

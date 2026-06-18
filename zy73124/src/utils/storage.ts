const STORAGE_KEYS = {
  reports: 'sea_report_reports',
  bottles: 'sea_report_bottles',
  changeLogs: 'sea_report_changeLogs',
  abnormals: 'sea_report_abnormals',
};

export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value) as T;
    }
  } catch (e) {
    console.error('Failed to get from storage:', e);
  }
  return defaultValue;
}

export function setToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to set to storage:', e);
  }
}

export const storage = {
  getReports: <T>(defaultValue: T) => getFromStorage<T>(STORAGE_KEYS.reports, defaultValue),
  setReports: <T>(value: T) => setToStorage<T>(STORAGE_KEYS.reports, value),
  getBottles: <T>(defaultValue: T) => getFromStorage<T>(STORAGE_KEYS.bottles, defaultValue),
  setBottles: <T>(value: T) => setToStorage<T>(STORAGE_KEYS.bottles, value),
  getChangeLogs: <T>(defaultValue: T) => getFromStorage<T>(STORAGE_KEYS.changeLogs, defaultValue),
  setChangeLogs: <T>(value: T) => setToStorage<T>(STORAGE_KEYS.changeLogs, value),
  getAbnormals: <T>(defaultValue: T) => getFromStorage<T>(STORAGE_KEYS.abnormals, defaultValue),
  setAbnormals: <T>(value: T) => setToStorage<T>(STORAGE_KEYS.abnormals, value),
};

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

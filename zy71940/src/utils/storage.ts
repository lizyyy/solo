import { STORAGE_KEYS } from '@/types';

export function saveToStorage<T>(key: string, data: T): void {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const json = localStorage.getItem(key);
    if (json === null) return defaultValue;
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return defaultValue;
  }
}

export function clearStorage(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function exportAllData(): string {
  const data: Record<string, unknown> = {};
  Object.values(STORAGE_KEYS).forEach((key) => {
    const value = localStorage.getItem(key);
    if (value) {
      data[key] = JSON.parse(value);
    }
  });
  return JSON.stringify(data, null, 2);
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    Object.entries(data).forEach(([key, value]) => {
      if (Object.values(STORAGE_KEYS).includes(key as typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS])) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

export function downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

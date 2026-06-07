const STORAGE_KEY = 'virtual-anchor-review-data';

export function saveToStorage(key: string, data: unknown): void {
  try {
    const fullData = getFullData();
    fullData[key] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const fullData = getFullData();
    return (fullData[key] as T) || defaultValue;
  } catch (e) {
    console.error('Storage load error:', e);
    return defaultValue;
  }
}

function getFullData(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

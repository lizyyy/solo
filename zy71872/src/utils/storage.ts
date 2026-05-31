const STORAGE_PREFIX = 'queue_sim_';

export function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(storageKey(key));
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
}

export function appendToStorage<T>(key: string, value: T): void {
  try {
    const existing = loadFromStorage<T[]>(key, []);
    existing.push(value);
    saveToStorage(key, existing);
  } catch (e) {
    console.error('Failed to append to storage:', e);
  }
}

export function clearStorage(key: string): void {
  localStorage.removeItem(storageKey(key));
}

export function clearAllStorage(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}

const STORAGE_PREFIX = 'vinyl_inventory_';

export function saveToStorage<T>(key: string, data: T): void {
  try {
    const fullKey = STORAGE_PREFIX + key;
    localStorage.setItem(fullKey, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const fullKey = STORAGE_PREFIX + key;
    const stored = localStorage.getItem(fullKey);
    if (stored === null) {
      return defaultValue;
    }
    return JSON.parse(stored) as T;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return defaultValue;
  }
}

export function removeFromStorage(key: string): void {
  try {
    const fullKey = STORAGE_PREFIX + key;
    localStorage.removeItem(fullKey);
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
  }
}

export function clearAllStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

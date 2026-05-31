const STORAGE_KEY = 'gallery_handover';
const STORAGE_VERSION = '1.0.0';

interface StorageData<T> {
  version: string;
  timestamp: string;
  data: T;
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    const storageData: StorageData<T> = {
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      data,
    };
    localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify(storageData));
  } catch (error) {
    console.error('Failed to save to storage:', error);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${key}`);
    if (!stored) return defaultValue;
    
    const storageData: StorageData<T> = JSON.parse(stored);
    return storageData.data;
  } catch (error) {
    console.error('Failed to load from storage:', error);
    return defaultValue;
  }
}

export function clearStorage(key: string): void {
  localStorage.removeItem(`${STORAGE_KEY}_${key}`);
}

export function clearAllStorage(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY));
  keys.forEach(k => localStorage.removeItem(k));
}

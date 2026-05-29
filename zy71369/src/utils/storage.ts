const PREFIX = 'comic-bubble-checker';

export function storageGet<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`${PREFIX}:${key}`);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  } catch (e) {
    console.error('Storage set error:', e);
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(`${PREFIX}:${key}`);
  } catch (e) {
    console.error('Storage remove error:', e);
  }
}

export function storageClear(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach(k => localStorage.removeItem(k));
}

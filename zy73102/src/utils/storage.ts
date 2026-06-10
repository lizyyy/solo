// localStorage 工具 - 带命名空间 'roof-tracker:'

const NAMESPACE = 'roof-tracker:';

// 构造完整 key
function buildKey(key: string): string {
  return `${NAMESPACE}${key}`;
}

// 判断是否支持 localStorage
function isAvailable(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取存储项（泛型）
 */
export function get<T = any>(key: string, defaultValue?: T): T | undefined {
  if (!isAvailable()) return defaultValue;
  try {
    const raw = localStorage.getItem(buildKey(key));
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 设置存储项（泛型）
 */
export function set<T = any>(key: string, value: T): void {
  if (!isAvailable()) return;
  try {
    const raw = JSON.stringify(value);
    localStorage.setItem(buildKey(key), raw);
  } catch {
    // 忽略写入错误（如配额超限）
  }
}

/**
 * 移除单个存储项
 */
export function remove(key: string): void {
  if (!isAvailable()) return;
  try {
    localStorage.removeItem(buildKey(key));
  } catch {
    // 忽略
  }
}

/**
 * 批量清空命名空间下的所有存储项
 */
export function clearAll(): void {
  if (!isAvailable()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(NAMESPACE)) {
        keysToRemove.push(fullKey);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // 忽略
  }
}

/**
 * 列出命名空间下的所有 key（不包含命名空间前缀）
 */
export function listKeys(): string[] {
  if (!isAvailable()) return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (fullKey && fullKey.startsWith(NAMESPACE)) {
      keys.push(fullKey.slice(NAMESPACE.length));
    }
  }
  return keys;
}

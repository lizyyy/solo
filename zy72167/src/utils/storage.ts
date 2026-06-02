import type { AppState } from '@/types';

const STORAGE_KEY = 'carbon-ledger-state';

export function saveToStorage(state: AppState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('保存到localStorage失败:', error);
  }
}

export function loadFromStorage(): AppState | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized) as AppState;
  } catch (error) {
    console.error('从localStorage加载失败:', error);
    return null;
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('清除localStorage失败:', error);
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSave(state: AppState, delay = 1000): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveToStorage(state);
  }, delay);
}

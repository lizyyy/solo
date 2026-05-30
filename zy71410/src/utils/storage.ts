import { AppState } from '../types';

const STORAGE_KEY = 'green_bond_fund_tracker_state';

export const loadState = (): AppState | null => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) return null;
    return JSON.parse(serialized);
  } catch (err) {
    console.error('加载状态失败:', err);
    return null;
  }
};

export const saveState = (state: AppState): void => {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.error('保存状态失败:', err);
  }
};

export const clearState = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const exportStateAsJson = (state: AppState): string => {
  return JSON.stringify(state, null, 2);
};

export const importStateFromJson = (json: string): AppState | null => {
  try {
    const parsed = JSON.parse(json);
    return parsed as AppState;
  } catch (err) {
    console.error('导入状态失败:', err);
    return null;
  }
};

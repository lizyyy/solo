import type { AudioMaterial, FilterState } from '../types';
import { mockMaterials } from './mockData';

const STORAGE_KEYS = {
  MATERIALS: 'audio_materials',
  FILTER: 'filter_state',
  PREFERENCES: 'app_preferences',
};

export const loadMaterials = (): AudioMaterial[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    if (stored) {
      return JSON.parse(stored);
    }
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(mockMaterials));
    return mockMaterials;
  } catch {
    return mockMaterials;
  }
};

export const saveMaterials = (materials: AudioMaterial[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
  } catch (e) {
    console.error('保存失败:', e);
  }
};

export const loadFilterState = (): FilterState => {
  const defaultFilter: FilterState = {
    emotionTag: 'all',
    status: 'all',
    source: 'all',
    exceptionType: 'all',
    dateRange: null,
    searchKeyword: '',
  };

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FILTER);
    if (stored) {
      return { ...defaultFilter, ...JSON.parse(stored) };
    }
    return defaultFilter;
  } catch {
    return defaultFilter;
  }
};

export const saveFilterState = (filter: FilterState): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.FILTER, JSON.stringify(filter));
  } catch (e) {
    console.error('保存筛选状态失败:', e);
  }
};

export const loadPreferences = (): { exceptionPanelOpen: boolean } => {
  const defaultPrefs = { exceptionPanelOpen: true };
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (stored) {
      return { ...defaultPrefs, ...JSON.parse(stored) };
    }
    return defaultPrefs;
  } catch {
    return defaultPrefs;
  }
};

export const savePreferences = (prefs: { exceptionPanelOpen: boolean }): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
  } catch (e) {
    console.error('保存偏好设置失败:', e);
  }
};

export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.MATERIALS);
  localStorage.removeItem(STORAGE_KEYS.FILTER);
  localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
};

export const resetToMockData = (): AudioMaterial[] => {
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(mockMaterials));
  return mockMaterials;
};

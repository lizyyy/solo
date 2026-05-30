import { STORAGE_KEYS } from './helpers';
import type {
  BandRequirement,
  VersionRecord,
  FilterSnapshot,
  ExportRecord,
  Channel,
  Monitor
} from '@/types';

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function loadFromStorage<T>(key: StorageKey, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return defaultValue;
  }
}

export function saveToStorage<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
}

export function removeFromStorage(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key} from localStorage:`, error);
  }
}

export function clearAllStorage(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

export interface PersistedState {
  requirements: BandRequirement[];
  versions: VersionRecord[];
  filterSnapshots: FilterSnapshot[];
  exportHistory: ExportRecord[];
  globalChannels: Channel[];
  globalMonitors: Monitor[];
}

export function loadPersistedState(): PersistedState {
  return {
    requirements: loadFromStorage<BandRequirement[]>(STORAGE_KEYS.REQUIREMENTS, []),
    versions: loadFromStorage<VersionRecord[]>(STORAGE_KEYS.VERSIONS, []),
    filterSnapshots: loadFromStorage<FilterSnapshot[]>(STORAGE_KEYS.FILTER_SNAPSHOTS, []),
    exportHistory: loadFromStorage<ExportRecord[]>(STORAGE_KEYS.EXPORT_HISTORY, []),
    globalChannels: loadFromStorage<Channel[]>(STORAGE_KEYS.GLOBAL_CHANNELS, []),
    globalMonitors: loadFromStorage<Monitor[]>(STORAGE_KEYS.GLOBAL_MONITORS, [])
  };
}

export function persistState(state: PersistedState): void {
  saveToStorage(STORAGE_KEYS.REQUIREMENTS, state.requirements);
  saveToStorage(STORAGE_KEYS.VERSIONS, state.versions);
  saveToStorage(STORAGE_KEYS.FILTER_SNAPSHOTS, state.filterSnapshots);
  saveToStorage(STORAGE_KEYS.EXPORT_HISTORY, state.exportHistory);
  saveToStorage(STORAGE_KEYS.GLOBAL_CHANNELS, state.globalChannels);
  saveToStorage(STORAGE_KEYS.GLOBAL_MONITORS, state.globalMonitors);
}

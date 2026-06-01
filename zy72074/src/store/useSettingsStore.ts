import { create } from 'zustand';
import type { AppSettings, PointStatus, CameraState } from '../types';
import { getLocalStorageItem, setLocalStorageItem, STORAGE_KEYS } from '../hooks/useLocalStorage';

interface SettingsStore extends AppSettings {
  setAutoRotate: (autoRotate: boolean) => void;
  setFilterStatus: (filterStatus: PointStatus | 'all') => void;
  setLastCameraState: (cameraState: CameraState) => void;
  initializeFromStorage: () => void;
}

const defaultSettings: AppSettings = {
  autoRotate: false,
  filterStatus: 'all',
  lastCameraState: null,
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...defaultSettings,

  setAutoRotate: (autoRotate) => {
    set({ autoRotate });
    setLocalStorageItem(STORAGE_KEYS.SETTINGS, get());
  },

  setFilterStatus: (filterStatus) => {
    set({ filterStatus });
    setLocalStorageItem(STORAGE_KEYS.SETTINGS, get());
  },

  setLastCameraState: (lastCameraState) => {
    set({ lastCameraState });
    setLocalStorageItem(STORAGE_KEYS.SETTINGS, get());
  },

  initializeFromStorage: () => {
    const storedSettings = getLocalStorageItem<Partial<AppSettings> | null>(STORAGE_KEYS.SETTINGS, null);
    if (storedSettings) {
      set({ ...defaultSettings, ...storedSettings });
    }
  },
}));

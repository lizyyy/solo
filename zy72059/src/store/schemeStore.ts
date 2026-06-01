import { create } from 'zustand';
import type { Scheme, Drone, Obstacle, Position3D } from '@/types';

const SCHEMES_STORAGE_KEY = 'uav_schemes';
const LAST_SCHEME_KEY = 'uav_last_scheme';

interface SchemeState {
  schemes: Scheme[];
  currentSchemeId: string | null;
  loadSchemes: () => void;
  saveScheme: (name: string, description: string, drones: Drone[], obstacles: Obstacle[], cameraState?: { position: Position3D; target: Position3D }) => Scheme;
  loadScheme: (id: string) => Scheme | null;
  deleteScheme: (id: string) => void;
  getCurrentScheme: () => Scheme | undefined;
  updateCurrentScheme: (drones: Drone[], obstacles: Obstacle[], cameraState?: { position: Position3D; target: Position3D }) => void;
}

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }
  return defaultValue;
};

const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

export const useSchemeStore = create<SchemeState>((set, get) => ({
  schemes: [],
  currentSchemeId: null,

  loadSchemes: () => {
    const schemes = loadFromStorage<Scheme[]>(SCHEMES_STORAGE_KEY, []);
    const lastSchemeId = loadFromStorage<string | null>(LAST_SCHEME_KEY, null);
    set({ schemes, currentSchemeId: lastSchemeId });
  },

  saveScheme: (name, description, drones, obstacles, cameraState) => {
    const now = new Date().toISOString();
    const newScheme: Scheme = {
      id: `scheme_${Date.now()}`,
      name,
      description,
      drones: JSON.parse(JSON.stringify(drones)),
      obstacles: JSON.parse(JSON.stringify(obstacles)),
      createdAt: now,
      updatedAt: now,
      author: '何工',
      cameraState,
    };

    const schemes = [...get().schemes, newScheme];
    saveToStorage(SCHEMES_STORAGE_KEY, schemes);
    saveToStorage(LAST_SCHEME_KEY, newScheme.id);
    set({ schemes, currentSchemeId: newScheme.id });
    return newScheme;
  },

  loadScheme: (id) => {
    const scheme = get().schemes.find((s) => s.id === id);
    if (scheme) {
      saveToStorage(LAST_SCHEME_KEY, id);
      set({ currentSchemeId: id });
    }
    return scheme || null;
  },

  deleteScheme: (id) => {
    const schemes = get().schemes.filter((s) => s.id !== id);
    saveToStorage(SCHEMES_STORAGE_KEY, schemes);
    set({
      schemes,
      currentSchemeId: get().currentSchemeId === id ? null : get().currentSchemeId,
    });
    if (get().currentSchemeId === id) {
      localStorage.removeItem(LAST_SCHEME_KEY);
    }
  },

  getCurrentScheme: () => {
    const { schemes, currentSchemeId } = get();
    return schemes.find((s) => s.id === currentSchemeId);
  },

  updateCurrentScheme: (drones, obstacles, cameraState) => {
    const { currentSchemeId, schemes } = get();
    if (!currentSchemeId) return;

    const updatedSchemes = schemes.map((s) =>
      s.id === currentSchemeId
        ? {
            ...s,
            drones: JSON.parse(JSON.stringify(drones)),
            obstacles: JSON.parse(JSON.stringify(obstacles)),
            updatedAt: new Date().toISOString(),
            cameraState,
          }
        : s
    );

    saveToStorage(SCHEMES_STORAGE_KEY, updatedSchemes);
    set({ schemes: updatedSchemes });
  },
}));

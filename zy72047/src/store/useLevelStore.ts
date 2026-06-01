import { create } from 'zustand';
import type { LevelConfig } from '@/types/game';
import { storage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/types/storage';
import { MOCK_LEVELS } from '@/data/levels';

interface LevelStore {
  levels: LevelConfig[];
  currentLevel: LevelConfig | null;
  loading: boolean;
  error: string | null;
  loadLevels: () => void;
  setCurrentLevel: (levelId: string) => void;
  addLevel: (level: LevelConfig) => void;
  updateLevel: (levelId: string, updates: Partial<LevelConfig>) => void;
  deleteLevel: (levelId: string) => void;
  importLevels: (levels: LevelConfig[]) => void;
  resetToDefaults: () => void;
}

export const useLevelStore = create<LevelStore>((set, get) => ({
  levels: [],
  currentLevel: null,
  loading: false,
  error: null,

  loadLevels: () => {
    set({ loading: true });
    try {
      let levels = storage.get(STORAGE_KEYS.LEVELS, [] as LevelConfig[]);
      
      if (levels.length === 0) {
        levels = MOCK_LEVELS;
        storage.set(STORAGE_KEYS.LEVELS, levels);
      }
      
      set({
        levels,
        currentLevel: levels[0] || null,
        loading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '加载关卡失败',
        loading: false,
      });
    }
  },

  setCurrentLevel: (levelId: string) => {
    const { levels } = get();
    const level = levels.find(l => l.id === levelId);
    if (level) {
      set({ currentLevel: level });
    }
  },

  addLevel: (level: LevelConfig) => {
    const { levels } = get();
    const updatedLevels = [...levels, level];
    storage.set(STORAGE_KEYS.LEVELS, updatedLevels);
    set({ levels: updatedLevels });
  },

  updateLevel: (levelId: string, updates: Partial<LevelConfig>) => {
    const { levels } = get();
    const updatedLevels = levels.map(l => 
      l.id === levelId ? { ...l, ...updates } : l
    );
    storage.set(STORAGE_KEYS.LEVELS, updatedLevels);
    set({ 
      levels: updatedLevels,
      currentLevel: get().currentLevel?.id === levelId 
        ? { ...get().currentLevel!, ...updates } 
        : get().currentLevel,
    });
  },

  deleteLevel: (levelId: string) => {
    const { levels, currentLevel } = get();
    const updatedLevels = levels.filter(l => l.id !== levelId);
    storage.set(STORAGE_KEYS.LEVELS, updatedLevels);
    set({
      levels: updatedLevels,
      currentLevel: currentLevel?.id === levelId ? updatedLevels[0] || null : currentLevel,
    });
  },

  importLevels: (newLevels: LevelConfig[]) => {
    const { levels } = get();
    const merged = [...levels];
    newLevels.forEach(newLevel => {
      const existingIndex = merged.findIndex(l => l.id === newLevel.id);
      if (existingIndex !== -1) {
        merged[existingIndex] = newLevel;
      } else {
        merged.push(newLevel);
      }
    });
    storage.set(STORAGE_KEYS.LEVELS, merged);
    set({ levels: merged });
  },

  resetToDefaults: () => {
    storage.set(STORAGE_KEYS.LEVELS, MOCK_LEVELS);
    set({
      levels: MOCK_LEVELS,
      currentLevel: MOCK_LEVELS[0] || null,
    });
  },
}));

import { create } from 'zustand';
import type { SafetyThreshold, ImportResult } from '@/types';
import { storage } from '@/utils/storage';
import { mockThresholds } from '@/utils/mockData';
import { dedupeThresholds, generateId } from '@/utils/helpers';

interface ThresholdState {
  thresholds: SafetyThreshold[];
  loading: boolean;
  importResult: ImportResult | null;
  init: () => void;
  importThresholds: (incoming: SafetyThreshold[]) => ImportResult;
  addThreshold: (threshold: Omit<SafetyThreshold, 'id' | 'createdAt'>) => void;
  updateThreshold: (id: string, updates: Partial<SafetyThreshold>) => void;
  deleteThreshold: (id: string) => void;
  getThresholdById: (id: string) => SafetyThreshold | undefined;
  clearImportResult: () => void;
  resetToMock: () => void;
}

export const useThresholdStore = create<ThresholdState>((set, get) => ({
  thresholds: [],
  loading: false,
  importResult: null,

  init: () => {
    const saved = storage.get<SafetyThreshold[]>('thresholds', []);
    if (saved.length === 0) {
      set({ thresholds: mockThresholds });
      storage.set('thresholds', mockThresholds);
    } else {
      set({ thresholds: saved });
    }
  },

  importThresholds: (incoming: SafetyThreshold[]) => {
    const existing = get().thresholds;
    const result = dedupeThresholds(incoming, existing);
    
    const newThresholds = [
      ...existing.map(e => {
        const updated = result.updatedItems.find(u => u.id === e.id);
        return updated || e;
      }),
      ...result.newItems,
    ];

    set({ thresholds: newThresholds, importResult: result });
    storage.set('thresholds', newThresholds);
    return result;
  },

  addThreshold: (threshold) => {
    const newThreshold: SafetyThreshold = {
      ...threshold,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const newThresholds = [...get().thresholds, newThreshold];
    set({ thresholds: newThresholds });
    storage.set('thresholds', newThresholds);
  },

  updateThreshold: (id, updates) => {
    const newThresholds = get().thresholds.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ thresholds: newThresholds });
    storage.set('thresholds', newThresholds);
  },

  deleteThreshold: (id) => {
    const newThresholds = get().thresholds.filter(t => t.id !== id);
    set({ thresholds: newThresholds });
    storage.set('thresholds', newThresholds);
  },

  getThresholdById: (id) => {
    return get().thresholds.find(t => t.id === id);
  },

  clearImportResult: () => {
    set({ importResult: null });
  },

  resetToMock: () => {
    set({ thresholds: mockThresholds });
    storage.set('thresholds', mockThresholds);
  },
}));

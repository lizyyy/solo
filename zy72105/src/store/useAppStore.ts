import { create } from 'zustand';
import type {
  AppState,
  AppActions,
  Batch,
  Note,
  ResolutionType,
  ThresholdConfig,
} from '../types';
import { DEFAULT_THRESHOLD_CONFIG as defaultConfig } from '../types';
import { getAllMockBatches } from '../utils/mockData';

const STORAGE_KEY_BATCHES = 'noise_prediction_batches';
const STORAGE_KEY_CONFIG = 'noise_prediction_config';

const loadBatchesFromStorage = (): Batch[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_BATCHES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('加载批次数据失败:', e);
  }
  const mockBatches = getAllMockBatches();
  localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(mockBatches));
  return mockBatches;
};

const loadConfigFromStorage = (): ThresholdConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('加载配置失败:', e);
  }
  return { ...defaultConfig };
};

const saveBatchesToStorage = (batches: Batch[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(batches));
  } catch (e) {
    console.error('保存批次数据失败:', e);
  }
};

const saveConfigToStorage = (config: ThresholdConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('保存配置失败:', e);
  }
};

const initialBatches = loadBatchesFromStorage();
const initialConfig = loadConfigFromStorage();

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  batches: initialBatches,
  currentBatchId: initialBatches.length > 0 ? initialBatches[0].id : null,
  thresholdConfig: initialConfig,
  selectedBatchIds: [],
  isCalculating: false,

  setCurrentBatch: (id: string | null) => {
    set({ currentBatchId: id });
  },

  addBatch: (batch: Batch) => {
    const newBatches = [...get().batches, batch];
    set({ batches: newBatches });
    saveBatchesToStorage(newBatches);
  },

  updateBatch: (batch: Batch) => {
    const newBatches = get().batches.map((b) =>
      b.id === batch.id ? { ...batch, updatedAt: Date.now() } : b
    );
    set({ batches: newBatches });
    saveBatchesToStorage(newBatches);
  },

  deleteBatch: (id: string) => {
    const newBatches = get().batches.filter((b) => b.id !== id);
    const newCurrentId = get().currentBatchId === id ?
      (newBatches.length > 0 ? newBatches[0].id : null) :
      get().currentBatchId;
    set({
      batches: newBatches,
      currentBatchId: newCurrentId,
      selectedBatchIds: get().selectedBatchIds.filter((bid) => bid !== id),
    });
    saveBatchesToStorage(newBatches);
  },

  selectBatch: (id: string) => {
    const selected = get().selectedBatchIds;
    if (!selected.includes(id)) {
      set({ selectedBatchIds: [...selected, id] });
    }
  },

  deselectBatch: (id: string) => {
    set({
      selectedBatchIds: get().selectedBatchIds.filter((bid) => bid !== id),
    });
  },

  clearSelection: () => {
    set({ selectedBatchIds: [] });
  },

  setCalculating: (calc: boolean) => {
    set({ isCalculating: calc });
  },

  updateThresholdConfig: (config: Partial<ThresholdConfig>) => {
    const newConfig = { ...get().thresholdConfig, ...config };
    set({ thresholdConfig: newConfig });
    saveConfigToStorage(newConfig);
  },

  addNoteToBatch: (batchId: string, note: Note) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (batch) {
      const updatedBatch = {
        ...batch,
        notes: [...batch.notes, note],
        updatedAt: Date.now(),
      };
      const newBatches = get().batches.map((b) =>
        b.id === batchId ? updatedBatch : b
      );
      set({ batches: newBatches });
      saveBatchesToStorage(newBatches);
    }
  },

  resolveConflict: (batchId: string, conflictId: string, resolution: ResolutionType, resolvedBy: string) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (batch) {
      const updatedConflicts = batch.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolution, resolvedBy, resolvedAt: Date.now() }
          : c
      );
      const updatedBatch = {
        ...batch,
        conflicts: updatedConflicts,
        updatedAt: Date.now(),
      };
      const newBatches = get().batches.map((b) =>
        b.id === batchId ? updatedBatch : b
      );
      set({ batches: newBatches });
      saveBatchesToStorage(newBatches);
    }
  },
}));

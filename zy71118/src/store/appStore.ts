import { create } from 'zustand';
import { AppStore, Store as StoreType, HistorySnapshot } from '../types';
import { generateSampleStore } from '../data/mockData';
import { runFullInspection } from '../utils/inspection';
import { generateReport } from '../utils/report';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const useAppStore = create<AppStore>((set, get) => ({
  store: null,
  initialStore: null,
  selectedShelfId: null,
  selectedSkuId: null,
  selectedSkuSlotId: null,
  issues: [],
  currentTime: 0,
  isPlaying: false,
  showHeatmap: false,
  showGoldenLayer: true,
  showIssues: true,
  filterCategory: null,
  history: [],
  historyIndex: -1,
  draggedSku: null,

  loadSampleData: () => {
    const sampleStore = generateSampleStore();
    const issues = runFullInspection(sampleStore);
    const initialSnapshot: HistorySnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label: '初始状态',
      store: deepClone(sampleStore),
      issues: deepClone(issues),
    };
    set({
      store: sampleStore,
      initialStore: deepClone(sampleStore),
      issues,
      history: [initialSnapshot],
      historyIndex: 0,
    });
  },

  setSelectedShelf: (id) => set({ selectedShelfId: id }),

  setSelectedSku: (skuId, slotId = null) => set({ 
    selectedSkuId: skuId,
    selectedSkuSlotId: slotId,
  }),

  setShowHeatmap: (show) => set({ showHeatmap: show }),

  setShowGoldenLayer: (show) => set({ showGoldenLayer: show }),

  setShowIssues: (show) => set({ showIssues: show }),

  setFilterCategory: (category) => set({ filterCategory: category }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setDraggedSku: (sku) => set({ draggedSku: sku }),

  moveSku: (fromShelfId, fromLayerIndex, fromSlotId, toShelfId, toLayerIndex, toPosition) => {
    const state = get();
    if (!state.store) return;

    const newStore = deepClone(state.store);
    
    const fromShelf = newStore.shelves.find(s => s.id === fromShelfId);
    const toShelf = newStore.shelves.find(s => s.id === toShelfId);
    
    if (!fromShelf || !toShelf) return;
    
    const fromLayer = fromShelf.layers[fromLayerIndex];
    const toLayer = toShelf.layers[toLayerIndex];
    
    if (!fromLayer || !toLayer) return;

    const slotIndex = fromLayer.slots.findIndex(s => s.id === fromSlotId);
    if (slotIndex === -1) return;

    const [movedSlot] = fromLayer.slots.splice(slotIndex, 1);
    movedSlot.position = toPosition;
    
    const insertIndex = toLayer.slots.findIndex(s => s.position >= toPosition);
    if (insertIndex === -1) {
      toLayer.slots.push(movedSlot);
    } else {
      toLayer.slots.splice(insertIndex, 0, movedSlot);
    }
    
    toLayer.slots.forEach((slot, idx) => {
      slot.position = idx;
    });

    const newIssues = runFullInspection(newStore);
    
    set({
      store: newStore,
      issues: newIssues,
      draggedSku: null,
      selectedSkuSlotId: movedSlot.id,
    });
  },

  saveSnapshot: (label) => {
    const state = get();
    if (!state.store) return;

    const snapshot: HistorySnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label,
      store: deepClone(state.store),
      issues: deepClone(state.issues),
    };

    const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot];
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  goToSnapshot: (index) => {
    const state = get();
    if (index < 0 || index >= state.history.length) return;

    const snapshot = state.history[index];
    set({
      store: deepClone(snapshot.store),
      issues: deepClone(snapshot.issues),
      historyIndex: index,
    });
  },

  resetState: () => {
    const state = get();
    if (!state.initialStore) return;

    const resetStore = deepClone(state.initialStore);
    const resetIssues = runFullInspection(resetStore);
    
    set({
      store: resetStore,
      issues: resetIssues,
      selectedShelfId: null,
      selectedSkuId: null,
      selectedSkuSlotId: null,
      historyIndex: 0,
      history: [state.history[0]],
    });
  },

  runInspection: () => {
    const state = get();
    if (!state.store) return;
    
    const newIssues = runFullInspection(state.store);
    set({ issues: newIssues });
  },

  exportReport: async () => {
    const state = get();
    if (!state.store) return;
    await generateReport(state.store, state.issues);
  },

  getCategories: () => {
    const state = get();
    if (!state.store) return [];
    
    const categories = new Set<string>();
    state.store.shelves.forEach(shelf => {
      shelf.layers.forEach(layer => {
        layer.slots.forEach(slot => {
          categories.add(slot.category);
        });
      });
    });
    return Array.from(categories);
  },

  getShelfById: (id) => {
    return get().store?.shelves.find(s => s.id === id);
  },

  getSkuSlotById: (slotId) => {
    const state = get();
    if (!state.store) return null;
    
    for (const shelf of state.store.shelves) {
      for (const layer of shelf.layers) {
        const slot = layer.slots.find(s => s.id === slotId);
        if (slot) {
          return { shelf, layer, slot };
        }
      }
    }
    return null;
  },
}));

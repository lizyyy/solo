import { create } from 'zustand';
import {
  AppState,
  CrackStatus,
  CrackPoint,
  InspectionBatch,
  CameraView,
} from '../types';
import { sampleBatches, sampleCracks } from '../data/sampleData';

interface InspectionStore extends AppState {
  setBatches: (batches: InspectionBatch[]) => void;
  setCracks: (cracks: CrackPoint[]) => void;
  setCurrentBatchId: (batchId: string) => void;
  setSelectedCrackId: (crackId: string | null) => void;
  setCameraView: (view: CameraView) => void;
  setStatusFilter: (statuses: CrackStatus[]) => void;
  setSearchQuery: (query: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  updateCrackPosition: (crackId: string, position: { x: number; y: number; z: number }) => void;
  loadSampleData: () => void;
  resetState: () => void;
  getFilteredCracks: () => CrackPoint[];
  getCurrentBatch: () => InspectionBatch | undefined;
  getCracksForBatch: (batchId: string) => CrackPoint[];
}

const initialState: AppState = {
  batches: [],
  cracks: [],
  currentBatchId: '',
  selectedCrackId: null,
  cameraView: {
    position: { x: 10, y: 8, z: 10 },
    target: { x: 0, y: 1, z: 0 },
  },
  filters: {
    status: [],
    searchQuery: '',
  },
  isPlaying: false,
  playSpeed: 1,
  sampleDataLoaded: false,
};

export const useInspectionStore = create<InspectionStore>((set, get) => ({
  ...initialState,

  setBatches: (batches) => set({ batches }),
  setCracks: (cracks) => set({ cracks }),
  setCurrentBatchId: (batchId) => set({ currentBatchId: batchId }),
  setSelectedCrackId: (crackId) => set({ selectedCrackId: crackId }),
  setCameraView: (cameraView) => set({ cameraView }),
  setStatusFilter: (status) => set((state) => ({ filters: { ...state.filters, status } })),
  setSearchQuery: (searchQuery) => set((state) => ({ filters: { ...state.filters, searchQuery } })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),

  updateCrackPosition: (crackId, position) =>
    set((state) => ({
      cracks: state.cracks.map((crack) =>
        crack.id === crackId ? { ...crack, position } : crack
      ),
    })),

  loadSampleData: () =>
    set({
      batches: sampleBatches,
      cracks: sampleCracks,
      currentBatchId: sampleBatches[sampleBatches.length - 1]?.id || '',
      sampleDataLoaded: true,
    }),

  resetState: () => set(initialState),

  getFilteredCracks: () => {
    const { cracks, filters } = get();
    let filtered = cracks;

    if (filters.status.length > 0) {
      filtered = filtered.filter((crack) => filters.status.includes(crack.status));
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (crack) =>
          crack.description.toLowerCase().includes(query) ||
          crack.id.toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  getCurrentBatch: () => {
    const { batches, currentBatchId } = get();
    return batches.find((b) => b.id === currentBatchId);
  },

  getCracksForBatch: (batchId: string) => {
    const { cracks } = get();
    return cracks.filter((crack) =>
      crack.history.some((h) => h.batchId === batchId)
    );
  },
}));

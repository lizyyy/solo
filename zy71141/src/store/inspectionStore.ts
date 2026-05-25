import { create } from 'zustand';
import {
  AppState,
  CrackStatus,
  CrackPoint,
  InspectionBatch,
  CameraView,
  Photo,
} from '../types';
import { sampleBatches, sampleCracks, samplePhotos } from '../data/sampleData';

interface InspectionStore extends AppState {
  photos: Photo[];
  setBatches: (batches: InspectionBatch[]) => void;
  setCracks: (cracks: CrackPoint[]) => void;
  setPhotos: (photos: Photo[]) => void;
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
  getCracksWithBatchStatus: () => CrackPoint[];
  getCurrentBatch: () => InspectionBatch | undefined;
  getCracksForBatch: (batchId: string) => CrackPoint[];
  getPhotosForCurrentBatch: () => Photo[];
}

const initialState: AppState & { photos: Photo[] } = {
  batches: [],
  cracks: [],
  photos: [],
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
  setPhotos: (photos) => set({ photos }),
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
      photos: samplePhotos,
      currentBatchId: sampleBatches[sampleBatches.length - 1]?.id || '',
      sampleDataLoaded: true,
    }),

  resetState: () => set(initialState),

  getFilteredCracks: () => {
    const { cracks, filters, currentBatchId } = get();
    let filtered = cracks;

    if (currentBatchId) {
      filtered = filtered.filter((crack) =>
        crack.history.some((h) => h.batchId === currentBatchId)
      );
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter((crack) => {
        const batchRecord = crack.history.find((h) => h.batchId === currentBatchId);
        const status = batchRecord?.status || crack.status;
        return filters.status.includes(status);
      });
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

  getCracksWithBatchStatus: () => {
    const { cracks, currentBatchId } = get();
    if (!currentBatchId) return cracks;

    return cracks
      .filter((crack) => crack.history.some((h) => h.batchId === currentBatchId))
      .map((crack) => {
        const batchRecord = crack.history.find((h) => h.batchId === currentBatchId);
        return {
          ...crack,
          status: batchRecord?.status || crack.status,
          length: batchRecord?.length || crack.length,
          width: batchRecord?.width || crack.width,
        };
      });
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

  getPhotosForCurrentBatch: () => {
    const { photos, currentBatchId } = get();
    return photos.filter((p) => p.batchId === currentBatchId);
  },
}));

import { create } from 'zustand';
import {
  AppState,
  AppActions,
  Boundary,
  BoundaryVertex,
  CameraState,
  DragState,
  PointCloudData,
  ToolMode,
} from '@/types';
import { MATERIALS } from '@/data/materials';
import { generateSamplePointCloud, SAMPLE_BOUNDARIES } from '@/data/mockData';
import { calculateVolumeForBoundary, calculateWeight } from '@/utils/volume';

const STORAGE_KEY = 'stockpile-inventory-batches';

const initialCameraState: CameraState = {
  position: [50, 50, 50],
  target: [0, 0, 0],
};

function loadBatchesFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const batches = JSON.parse(stored);
      return batches.map((b: unknown) => ({
        ...(b as object),
        timestamp: new Date((b as { timestamp: string }).timestamp),
      }));
    }
  } catch {
    console.warn('Failed to load batches from storage');
  }
  return [];
}

function saveBatchesToStorage(batches: unknown[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  } catch {
    console.warn('Failed to save batches to storage');
  }
}

type StoreState = AppState & AppActions;

export const useStore = create<StoreState>((set, get) => ({
  pointCloud: null,
  boundaries: [],
  selectedBoundaryId: null,
  activeBatchId: null,
  batches: loadBatchesFromStorage(),
  materials: MATERIALS,
  toolMode: 'select',
  baseHeight: 0,
  isDrawing: false,
  drawingVertices: [],
  cameraState: initialCameraState,
  showReportModal: false,
  dragState: null,
  compareBatchIds: [],

  setPointCloud: (pointCloud: PointCloudData | null) => {
    set({ pointCloud });
  },

  addBoundary: (boundary: Boundary) => {
    set(state => {
      const newBoundaries = [...state.boundaries, boundary];
      return {
        boundaries: newBoundaries,
        selectedBoundaryId: boundary.id,
        toolMode: 'select' as ToolMode,
        isDrawing: false,
        drawingVertices: [],
      };
    });
    get().calculateVolumes();
  },

  updateBoundary: (id: string, updates: Partial<Boundary>) => {
    set(state => ({
      boundaries: state.boundaries.map(b =>
        b.id === id ? { ...b, ...updates } : b
      ),
    }));
    get().calculateVolumes();
  },

  deleteBoundary: (id: string) => {
    set(state => ({
      boundaries: state.boundaries.filter(b => b.id !== id),
      selectedBoundaryId: state.selectedBoundaryId === id ? null : state.selectedBoundaryId,
    }));
  },

  setSelectedBoundaryId: (id: string | null) => {
    set({ selectedBoundaryId: id });
  },

  setToolMode: (mode: ToolMode) => {
    set(state => ({
      toolMode: mode,
      isDrawing: false,
      dragState: null,
      drawingVertices: mode === 'draw' ? [] : state.drawingVertices,
    }));
  },

  setBaseHeight: (height: number) => {
    set(state => ({
      baseHeight: height,
      boundaries: state.boundaries.map(b => ({
        ...b,
        baseHeight: height,
      })),
    }));
    setTimeout(() => {
      get().calculateVolumes();
    }, 0);
  },

  setIsDrawing: (isDrawing: boolean) => {
    set({ isDrawing });
  },

  addDrawingVertex: (vertex: { x: number; z: number }) => {
    set(state => ({
      drawingVertices: [...state.drawingVertices, vertex],
    }));
  },

  clearDrawingVertices: () => {
    set({ drawingVertices: [] });
  },

  setCameraState: (cameraState: CameraState) => {
    set({ cameraState });
  },

  saveBatch: (name: string) => {
    const state = get();
    const newBatch = {
      id: 'batch-' + Date.now(),
      name,
      timestamp: new Date(),
      boundaries: JSON.parse(JSON.stringify(state.boundaries)),
      cameraState: state.cameraState,
      baseHeight: state.baseHeight,
    };

    set(s => {
      const newBatches = [...s.batches, newBatch];
      saveBatchesToStorage(newBatches);
      return {
        batches: newBatches,
        activeBatchId: newBatch.id,
      };
    });
  },

  loadBatch: (id: string) => {
    const batch = get().batches.find(b => b.id === id);
    if (batch) {
      set({
        boundaries: JSON.parse(JSON.stringify(batch.boundaries)),
        cameraState: batch.cameraState,
        baseHeight: batch.baseHeight,
        activeBatchId: id,
        selectedBoundaryId: null,
      });
    }
  },

  deleteBatch: (id: string) => {
    set(state => {
      const newBatches = state.batches.filter(b => b.id !== id);
      saveBatchesToStorage(newBatches);
      return {
        batches: newBatches,
        activeBatchId: state.activeBatchId === id ? null : state.activeBatchId,
        compareBatchIds: state.compareBatchIds.filter(bid => bid !== id),
      };
    });
  },

  resetState: () => {
    set({
      boundaries: [],
      selectedBoundaryId: null,
      toolMode: 'select',
      baseHeight: 0,
      isDrawing: false,
      drawingVertices: [],
      activeBatchId: null,
      cameraState: initialCameraState,
      dragState: null,
      compareBatchIds: [],
    });
  },

  setShowReportModal: (show: boolean) => {
    set({ showReportModal: show });
  },

  calculateVolumes: () => {
    const state = get();
    if (!state.pointCloud) return;

    const updatedBoundaries = state.boundaries.map(boundary => {
      const result = calculateVolumeForBoundary(boundary, state.pointCloud!.points);
      const material = state.materials.find(m => m.id === boundary.materialId);
      const weight = calculateWeight(result.volume, material?.density || 1);

      return {
        ...boundary,
        volume: result.volume,
        surfaceArea: result.surfaceArea,
        weight,
      };
    });

    set({ boundaries: updatedBoundaries });
  },

  loadSampleData: () => {
    const pointCloud = generateSamplePointCloud();
    const boundaries = SAMPLE_BOUNDARIES.map(b => ({
      ...b,
      id: 'boundary-' + Math.random().toString(36).substr(2, 9),
    }));

    set({
      pointCloud,
      boundaries,
      selectedBoundaryId: null,
      baseHeight: 0,
    });

    setTimeout(() => {
      get().calculateVolumes();
    }, 100);
  },

  setDragState: (dragState: DragState | null) => {
    set({ dragState });
  },

  updateVertex: (boundaryId: string, vertexIndex: number, newPos: BoundaryVertex) => {
    set(state => ({
      boundaries: state.boundaries.map(b => {
        if (b.id !== boundaryId) return b;
        const newVertices = [...b.vertices];
        newVertices[vertexIndex] = newPos;
        return { ...b, vertices: newVertices };
      }),
    }));
    get().calculateVolumes();
  },

  toggleCompareBatch: (batchId: string) => {
    set(state => {
      const isComparing = state.compareBatchIds.includes(batchId);
      return {
        compareBatchIds: isComparing
          ? state.compareBatchIds.filter(id => id !== batchId)
          : [...state.compareBatchIds, batchId],
      };
    });
  },

  clearCompareBatches: () => {
    set({ compareBatchIds: [] });
  },
}));

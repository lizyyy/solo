import { create } from 'zustand';
import {
  ExcavationSquare,
  SoilLayer,
  Artifact,
  FilterState,
  ValidationError,
  TimelineState,
  CameraView,
} from '../types';

interface AppState {
  excavationData: ExcavationSquare | null;
  filters: FilterState;
  selectedArtifact: Artifact | null;
  validationErrors: ValidationError[];
  timeline: TimelineState;
  cameraView: CameraView;
  depthRange: [number, number];
  visibleLayerIds: string[];
  hoveredArtifactId: string | null;

  setExcavationData: (data: ExcavationSquare) => void;
  toggleLayerVisibility: (layerId: string) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  showAllLayers: () => void;
  hideAllLayers: () => void;

  setFilterTypes: (types: FilterState['types']) => void;
  setFilterPeriods: (periods: FilterState['periods']) => void;
  setFilterDepthRange: (range: FilterState['depthRange']) => void;
  setFilterLayerIds: (layerIds: FilterState['layerIds']) => void;
  resetFilters: () => void;

  selectArtifact: (artifactId: string | null) => void;
  setHoveredArtifact: (artifactId: string | null) => void;

  setValidationErrors: (errors: ValidationError[]) => void;

  setTimelinePlaying: (isPlaying: boolean) => void;
  setTimelinePeriodIndex: (index: number) => void;
  setTimelineSpeed: (speed: number) => void;

  setCameraView: (view: CameraView) => void;
  setDepthRange: (range: [number, number]) => void;

  resetAll: () => void;
}

const initialFilters: FilterState = {
  types: [],
  periods: [],
  depthRange: [0, 200],
  layerIds: [],
};

const initialTimeline: TimelineState = {
  isPlaying: false,
  currentPeriodIndex: 0,
  speed: 1,
};

export const useStore = create<AppState>((set, get) => ({
  excavationData: null,
  filters: initialFilters,
  selectedArtifact: null,
  validationErrors: [],
  timeline: initialTimeline,
  cameraView: 'perspective',
  depthRange: [0, 200],
  visibleLayerIds: [],
  hoveredArtifactId: null,

  setExcavationData: (data) => {
    const visibleLayerIds = data.layers.map((l) => l.id);
    set({
      excavationData: data,
      visibleLayerIds,
      depthRange: [0, data.gridSize.z],
      filters: {
        ...initialFilters,
        depthRange: [0, data.gridSize.z],
      },
      selectedArtifact: null,
      validationErrors: [],
    });
  },

  toggleLayerVisibility: (layerId) => {
    const { visibleLayerIds } = get();
    const isVisible = visibleLayerIds.includes(layerId);
    set({
      visibleLayerIds: isVisible
        ? visibleLayerIds.filter((id) => id !== layerId)
        : [...visibleLayerIds, layerId],
    });
  },

  setLayerVisibility: (layerId, visible) => {
    const { visibleLayerIds } = get();
    const isVisible = visibleLayerIds.includes(layerId);
    if (visible && !isVisible) {
      set({ visibleLayerIds: [...visibleLayerIds, layerId] });
    } else if (!visible && isVisible) {
      set({ visibleLayerIds: visibleLayerIds.filter((id) => id !== layerId) });
    }
  },

  showAllLayers: () => {
    const { excavationData } = get();
    if (excavationData) {
      set({ visibleLayerIds: excavationData.layers.map((l) => l.id) });
    }
  },

  hideAllLayers: () => {
    set({ visibleLayerIds: [] });
  },

  setFilterTypes: (types) =>
    set((state) => ({ filters: { ...state.filters, types } })),

  setFilterPeriods: (periods) =>
    set((state) => ({ filters: { ...state.filters, periods } })),

  setFilterDepthRange: (depthRange) =>
    set((state) => ({ filters: { ...state.filters, depthRange } })),

  setFilterLayerIds: (layerIds) =>
    set((state) => ({ filters: { ...state.filters, layerIds } })),

  resetFilters: () => {
    const { excavationData } = get();
    set({
      filters: {
        ...initialFilters,
        depthRange: excavationData
          ? [0, excavationData.gridSize.z]
          : [0, 200],
      },
    });
  },

  selectArtifact: (artifactId) => {
    const { excavationData } = get();
    if (!excavationData || !artifactId) {
      set({ selectedArtifact: null });
      return;
    }
    const artifact = excavationData.artifacts.find((a) => a.id === artifactId);
    set({ selectedArtifact: artifact || null });
  },

  setHoveredArtifact: (artifactId) => set({ hoveredArtifactId: artifactId }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  setTimelinePlaying: (isPlaying) =>
    set((state) => ({ timeline: { ...state.timeline, isPlaying } })),

  setTimelinePeriodIndex: (currentPeriodIndex) =>
    set((state) => ({ timeline: { ...state.timeline, currentPeriodIndex } })),

  setTimelineSpeed: (speed) =>
    set((state) => ({ timeline: { ...state.timeline, speed } })),

  setCameraView: (cameraView) => set({ cameraView }),

  setDepthRange: (depthRange) => set({ depthRange }),

  resetAll: () => {
    const { excavationData } = get();
    if (excavationData) {
      get().setExcavationData(excavationData);
    }
    set({
      cameraView: 'perspective',
      timeline: initialTimeline,
      selectedArtifact: null,
      hoveredArtifactId: null,
    });
  },
}));

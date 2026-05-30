import { create } from 'zustand';
import type { ViewState, ProjectionPlane, Point3D, FilterRange } from '../types/surface';

interface ViewStore extends ViewState {
  cameraPosition: Point3D;
  cameraTarget: Point3D;
  filterRange: FilterRange;
  exportLocked: boolean;

  setCameraPosition: (pos: Point3D) => void;
  setCameraTarget: (target: Point3D) => void;
  setShowSurface: (show: boolean) => void;
  setShowNormals: (show: boolean) => void;
  setShowBoundary: (show: boolean) => void;
  setShowSamples: (show: boolean) => void;
  setShowProjection: (show: boolean) => void;
  setProjectionPlane: (plane: ProjectionPlane) => void;
  setNormalLength: (length: number) => void;
  setNormalDensity: (density: number) => void;
  setSliceParams: (params: Partial<ViewState['sliceParams']>) => void;
  setHighlightReversedNormals: (highlight: boolean) => void;
  setFilterRange: (range: Partial<FilterRange>) => void;
  setExportLocked: (locked: boolean) => void;
  resetView: () => void;
}

const defaultSliceParams = {
  uMin: 0,
  uMax: 1,
  vMin: 0,
  vMax: 1,
};

export const useViewStore = create<ViewStore>((set) => ({
  showSurface: true,
  showNormals: true,
  showBoundary: true,
  showSamples: true,
  showProjection: false,
  projectionPlane: 'xy',
  normalLength: 0.3,
  normalDensity: 8,
  sliceParams: defaultSliceParams,
  highlightReversedNormals: true,
  cameraPosition: { x: 3, y: 3, z: 3 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  filterRange: {},
  exportLocked: false,

  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
  setShowSurface: (show) => set({ showSurface: show }),
  setShowNormals: (show) => set({ showNormals: show }),
  setShowBoundary: (show) => set({ showBoundary: show }),
  setShowSamples: (show) => set({ showSamples: show }),
  setShowProjection: (show) => set({ showProjection: show }),
  setProjectionPlane: (plane) => set({ projectionPlane: plane }),
  setNormalLength: (length) => set({ normalLength: length }),
  setNormalDensity: (density) => set({ normalDensity: density }),
  setSliceParams: (params) =>
    set((state) => ({
      sliceParams: { ...state.sliceParams, ...params },
    })),
  setHighlightReversedNormals: (highlight) =>
    set({ highlightReversedNormals: highlight }),
  setFilterRange: (range) =>
    set((state) => ({
      filterRange: { ...state.filterRange, ...range },
    })),
  setExportLocked: (locked) => set({ exportLocked: locked }),
  resetView: () =>
    set({
      showSurface: true,
      showNormals: true,
      showBoundary: true,
      showSamples: true,
      showProjection: false,
      projectionPlane: 'xy',
      normalLength: 0.3,
      normalDensity: 8,
      sliceParams: defaultSliceParams,
      highlightReversedNormals: true,
      cameraPosition: { x: 3, y: 3, z: 3 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      filterRange: {},
    }),
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GaitFrame,
  SkeletonPoint,
  CameraState,
  FilterState,
  ProcessNote,
  AnomalyType,
  BoneGroup,
  DataSource,
} from '../types';
import { MOCK_FRAMES } from '../data/mockData';

interface GaitState {
  frames: GaitFrame[];
  currentFrameIndex: number;
  selectedPointId: string | null;
  cameraState: CameraState;
  filters: FilterState;
  isPlaying: boolean;
  playSpeed: number;
  importReport: {
    fileName: string;
    importedAt: string;
    totalPoints: number;
    warnings: string[];
  } | null;
  setFrames: (frames: GaitFrame[]) => void;
  setCurrentFrameIndex: (index: number) => void;
  setSelectedPointId: (id: string | null) => void;
  setCameraState: (state: CameraState) => void;
  toggleBoneGroupFilter: (group: BoneGroup) => void;
  toggleDataSourceFilter: (source: DataSource) => void;
  setShowAnomalyOnly: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  togglePointAnomaly: (pointId: string, anomalyType?: AnomalyType, anomalyNote?: string) => void;
  addNoteToPoint: (pointId: string, content: string, author: string) => void;
  updatePointCoordinates: (pointId: string, x: number, y: number, z: number, author: string) => void;
  setImportReport: (report: { fileName: string; importedAt: string; totalPoints: number; warnings: string[] } | null) => void;
  getCurrentFrame: () => GaitFrame | undefined;
  getSelectedPoint: () => SkeletonPoint | undefined;
  getFilteredPoints: () => SkeletonPoint[];
}

const initialCameraState: CameraState = {
  position: [3, 2, 3],
  target: [0, 0.8, 0],
};

const initialFilters: FilterState = {
  boneGroups: [],
  dataSources: [],
  showAnomalyOnly: false,
  searchQuery: '',
};

export const useGaitStore = create<GaitState>()(
  persist(
    (set, get) => ({
      frames: MOCK_FRAMES,
      currentFrameIndex: 0,
      selectedPointId: null,
      cameraState: initialCameraState,
      filters: initialFilters,
      isPlaying: false,
      playSpeed: 1,
      importReport: null,

      setFrames: (frames) => set({ frames }),

      setCurrentFrameIndex: (index) => {
        const maxIndex = get().frames.length - 1;
        set({ currentFrameIndex: Math.max(0, Math.min(index, maxIndex)) });
      },

      setSelectedPointId: (id) => set({ selectedPointId: id }),

      setCameraState: (state) => set({ cameraState: state }),

      toggleBoneGroupFilter: (group) =>
        set((state) => {
          const groups = state.filters.boneGroups.includes(group)
            ? state.filters.boneGroups.filter((g) => g !== group)
            : [...state.filters.boneGroups, group];
          return { filters: { ...state.filters, boneGroups: groups } };
        }),

      toggleDataSourceFilter: (source) =>
        set((state) => {
          const sources = state.filters.dataSources.includes(source)
            ? state.filters.dataSources.filter((s) => s !== source)
            : [...state.filters.dataSources, source];
          return { filters: { ...state.filters, dataSources: sources } };
        }),

      setShowAnomalyOnly: (show) =>
        set((state) => ({ filters: { ...state.filters, showAnomalyOnly: show } })),

      setSearchQuery: (query) =>
        set((state) => ({ filters: { ...state.filters, searchQuery: query } })),

      setIsPlaying: (playing) => set({ isPlaying: playing }),

      setPlaySpeed: (speed) => set({ playSpeed: Math.max(0.25, Math.min(4, speed)) }),

      togglePointAnomaly: (pointId, anomalyType, anomalyNote) =>
        set((state) => {
          const newFrames = state.frames.map((frame) => ({
            ...frame,
            points: frame.points.map((point) => {
              if (point.id === pointId || point.name === pointId.split('_frame')[0]) {
                const isNowAnomaly = !point.isAnomaly;
                return {
                  ...point,
                  isAnomaly: isNowAnomaly,
                  anomalyType: isNowAnomaly ? anomalyType : undefined,
                  anomalyNote: isNowAnomaly ? anomalyNote : undefined,
                  updatedAt: new Date().toISOString(),
                };
              }
              return point;
            }),
          }));
          return { frames: newFrames };
        }),

      addNoteToPoint: (pointId, content, author) =>
        set((state) => {
          const newNote: ProcessNote = {
            id: Math.random().toString(36).substring(2, 11),
            pointId,
            content,
            author,
            createdAt: new Date().toISOString(),
          };
          const newFrames = state.frames.map((frame) => ({
            ...frame,
            points: frame.points.map((point) => {
              if (point.id === pointId || point.name === pointId.split('_frame')[0]) {
                return {
                  ...point,
                  notes: [...point.notes, newNote],
                  updatedAt: new Date().toISOString(),
                };
              }
              return point;
            }),
          }));
          return { frames: newFrames };
        }),

      updatePointCoordinates: (pointId, x, y, z, author) =>
        set((state) => {
          const currentPoint = state.frames.flatMap((f) => f.points).find((p) => p.id === pointId);
          const diff = currentPoint
            ? {
                previous: { x: currentPoint.x, y: currentPoint.y, z: currentPoint.z },
                current: { x, y, z },
              }
            : undefined;

          const newNote: ProcessNote = {
            id: Math.random().toString(36).substring(2, 11),
            pointId,
            content: `坐标已更新：(${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)})`,
            author,
            createdAt: new Date().toISOString(),
            diff,
          };

          const newFrames = state.frames.map((frame) => ({
            ...frame,
            points: frame.points.map((point) => {
              if (point.id === pointId) {
                return {
                  ...point,
                  x,
                  y,
                  z,
                  source: 'manual_edit' as DataSource,
                  notes: [...point.notes, newNote],
                  updatedAt: new Date().toISOString(),
                  processedBy: author,
                };
              }
              return point;
            }),
          }));
          return { frames: newFrames };
        }),

      setImportReport: (report) => set({ importReport: report }),

      getCurrentFrame: () => {
        const state = get();
        return state.frames[state.currentFrameIndex];
      },

      getSelectedPoint: () => {
        const state = get();
        const currentFrame = state.frames[state.currentFrameIndex];
        return currentFrame?.points.find((p) => p.id === state.selectedPointId || p.name === state.selectedPointId);
      },

      getFilteredPoints: () => {
        const state = get();
        const currentFrame = state.frames[state.currentFrameIndex];
        if (!currentFrame) return [];

        return currentFrame.points.filter((point) => {
          if (state.filters.boneGroups.length > 0 && !state.filters.boneGroups.includes(point.boneGroup)) {
            return false;
          }
          if (state.filters.dataSources.length > 0 && !state.filters.dataSources.includes(point.source)) {
            return false;
          }
          if (state.filters.showAnomalyOnly && !point.isAnomaly) {
            return false;
          }
          if (state.filters.searchQuery) {
            const query = state.filters.searchQuery.toLowerCase();
            if (!point.name.toLowerCase().includes(query) && !point.nameCn.includes(query)) {
              return false;
            }
          }
          return true;
        });
      },
    }),
    {
      name: 'gait-skeleton-storage',
      partialize: (state) => ({
        frames: state.frames,
        currentFrameIndex: state.currentFrameIndex,
        selectedPointId: state.selectedPointId,
        cameraState: state.cameraState,
        filters: state.filters,
        playSpeed: state.playSpeed,
        importReport: state.importReport,
      }),
    },
  ),
);

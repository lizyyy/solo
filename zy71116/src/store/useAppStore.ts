import { create } from 'zustand';
import {
  AppState,
  CampusData,
  Route,
  FilterState,
  CameraState,
} from '../types';
import { mockCampusData } from '../data/mockCampus';

const initialFilters: FilterState = {
  maxSlope: 5,
  avoidConstruction: true,
  preferElevator: true,
  showRamps: true,
  showElevators: true,
  showConstructions: true,
};

const initialCamera: CameraState = {
  position: { x: 50, y: 50, z: 50 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
};

export const useAppStore = create<AppState & {
  setCampusData: (data: CampusData) => void;
  setCurrentRoute: (route: Route | null) => void;
  setSelectedStartPoint: (id: string | null) => void;
  setSelectedEndPoint: (id: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setCameraState: (state: CameraState) => void;
  setTimelinePosition: (position: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  resetState: () => void;
  loadSampleData: () => void;
}>((set) => ({
  campusData: null,
  currentRoute: null,
  selectedStartPoint: null,
  selectedEndPoint: null,
  filters: initialFilters,
  cameraState: initialCamera,
  timelinePosition: 0,
  isPlaying: false,
  isLoading: false,

  setCampusData: (data) => set({ campusData: data }),
  setCurrentRoute: (route) => set({ currentRoute: route }),
  setSelectedStartPoint: (id) => set({ selectedStartPoint: id }),
  setSelectedEndPoint: (id) => set({ selectedEndPoint: id }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  setCameraState: (cameraState) => set({ cameraState }),
  setTimelinePosition: (timelinePosition) =>
    set((state) => ({
      timelinePosition:
        typeof timelinePosition === 'function'
          ? timelinePosition(state.timelinePosition)
          : timelinePosition,
    })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLoading: (isLoading) => set({ isLoading }),

  resetState: () =>
    set({
      currentRoute: null,
      selectedStartPoint: null,
      selectedEndPoint: null,
      filters: initialFilters,
      cameraState: initialCamera,
      timelinePosition: 0,
      isPlaying: false,
    }),

  loadSampleData: () => {
    set({ campusData: mockCampusData, isLoading: false });
  },
}));

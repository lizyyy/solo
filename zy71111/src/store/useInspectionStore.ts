
import { create } from 'zustand';
import { InspectionData, CrackLevel, RecheckStatus, Annotation } from '../types';
import { mockInspectionData } from '../data/mockData';

interface InspectionState {
  inspectionData: InspectionData | null;
  filterLevel: CrackLevel[];
  filterStatus: RecheckStatus[];
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  selectedAnnotation: string | null;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];

  loadSampleData: () => void;
  setFilterLevel: (levels: CrackLevel[]) => void;
  setFilterStatus: (status: RecheckStatus[]) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  selectAnnotation: (id: string | null) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  setCameraState: (pos: [number, number, number], target: [number, number, number]) => void;
  resetState: () => void;
  getFilteredAnnotations: () => Annotation[];
}

const initialState = {
  inspectionData: null,
  filterLevel: [CrackLevel.LIGHT, CrackLevel.MODERATE, CrackLevel.SEVERE],
  filterStatus: [RecheckStatus.PENDING, RecheckStatus.VERIFIED, RecheckStatus.RESOLVED],
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 1,
  selectedAnnotation: null,
  cameraPosition: [0, 0, 12] as [number, number, number],
  cameraTarget: [0, 0, 0] as [number, number, number],
};

export const useInspectionStore = create<InspectionState>((set, get) => ({
  ...initialState,

  loadSampleData: () => {
    set({
      inspectionData: mockInspectionData,
      currentTime: mockInspectionData.startTime,
    });
  },

  setFilterLevel: (levels) => set({ filterLevel: levels }),

  setFilterStatus: (status) => set({ filterStatus: status }),

  setCurrentTime: (time) =>
    set((state) => ({
      currentTime: typeof time === 'function' ? time(state.currentTime) : time,
    })),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  selectAnnotation: (id) => set({ selectedAnnotation: id }),

  updateAnnotation: (id, updates) => {
    set((state) => {
      if (!state.inspectionData) return state;
      return {
        inspectionData: {
          ...state.inspectionData,
          annotations: state.inspectionData.annotations.map((ann) =>
            ann.id === id ? { ...ann, ...updates } : ann
          ),
        },
      };
    });
  },

  setCameraState: (pos, target) => set({ cameraPosition: pos, cameraTarget: target }),

  resetState: () => {
    const data = get().inspectionData;
    set({
      ...initialState,
      inspectionData: data,
      currentTime: data?.startTime || 0,
      filterLevel: [CrackLevel.LIGHT, CrackLevel.MODERATE, CrackLevel.SEVERE],
      filterStatus: [RecheckStatus.PENDING, RecheckStatus.VERIFIED, RecheckStatus.RESOLVED],
    });
  },

  getFilteredAnnotations: () => {
    const state = get();
    if (!state.inspectionData) return [];
    return state.inspectionData.annotations.filter(
      (ann) =>
        state.filterLevel.includes(ann.crackLevel) &&
        state.filterStatus.includes(ann.recheckStatus)
    );
  },
}));

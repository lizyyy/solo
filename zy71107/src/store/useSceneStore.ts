import { create } from 'zustand';
import {
  SceneState,
  SceneActions,
  ExhibitionHall,
  VisitorTrajectory,
  BatchData,
  AnomalyReport,
  CameraView,
  SampleType,
} from '../data/types';
import { validateAllData } from '../utils/dataValidator';
import { normalSample, conflictSample, emptySample } from '../data/samples';

const initialState: SceneState = {
  hallData: null,
  trajectories: [],
  batches: [],
  anomalies: [],
  
  isPlaying: false,
  currentTime: 0,
  playbackSpeed: 1,
  totalDuration: 0,
  
  selectedBatch: null,
  selectedShowcases: [],
  showHeatmap: true,
  showTrajectories: true,
  highlightAnomalies: true,
  
  cameraView: 'perspective',
  selectedShowcase: null,
  selectedVisitor: null,
  
  currentSample: null,
};

export const useSceneStore = create<SceneState & SceneActions>((set, get) => ({
  ...initialState,
  
  setHallData: (data) => set({ hallData: data }),
  setTrajectories: (data) => set({ trajectories: data }),
  setBatches: (data) => set({ batches: data }),
  setAnomalies: (data) => set({ anomalies: data }),
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time: number | ((prev: number) => number)) =>
    set((state) => ({
      currentTime: typeof time === 'function' ? time(state.currentTime) : time,
    })),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setTotalDuration: (duration) => set({ totalDuration: duration }),
  
  setSelectedBatch: (batchId) => set({ selectedBatch: batchId }),
  toggleShowcase: (showcaseId) =>
    set((state) => ({
      selectedShowcases: state.selectedShowcases.includes(showcaseId)
        ? state.selectedShowcases.filter((id) => id !== showcaseId)
        : [...state.selectedShowcases, showcaseId],
    })),
  setShowHeatmap: (show) => set({ showHeatmap: show }),
  setShowTrajectories: (show) => set({ showTrajectories: show }),
  setHighlightAnomalies: (highlight) => set({ highlightAnomalies: highlight }),
  
  setCameraView: (view) => set({ cameraView: view }),
  setSelectedShowcase: (showcaseId) => set({ selectedShowcase: showcaseId }),
  setSelectedVisitor: (visitorId) => set({ selectedVisitor: visitorId }),
  
  loadSample: (type: SampleType) => {
    let sampleData;
    switch (type) {
      case 'normal':
        sampleData = normalSample;
        break;
      case 'conflict':
        sampleData = conflictSample;
        break;
      case 'empty':
        sampleData = emptySample;
        break;
    }
    
    const anomalies = validateAllData(sampleData.trajectories, sampleData.hall.showcases);
    
    const totalDuration = Math.max(
      ...sampleData.trajectories.map((t) => t.endTime),
      ...sampleData.batches.map((b) => b.endTime)
    );
    
    set({
      hallData: sampleData.hall,
      trajectories: sampleData.trajectories,
      batches: sampleData.batches,
      anomalies,
      currentSample: type,
      totalDuration,
      currentTime: 0,
      isPlaying: false,
      selectedBatch: null,
      selectedShowcases: [],
      selectedShowcase: null,
      selectedVisitor: null,
    });
  },
  
  resetState: () => {
    const { currentSample } = get();
    if (currentSample) {
      get().loadSample(currentSample);
    } else {
      set(initialState);
    }
  },
}));

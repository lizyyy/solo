import { create } from 'zustand';
import { SceneState, ViewMode, SampleScene } from '../types';
import { defaultScene } from '../data/sampleScenes';
import { detectRisks } from '../utils/riskDetection';

interface SceneStore extends SceneState {
  setCraneAngle: (angle: number) => void;
  setCraneRadius: (radius: number) => void;
  setLiftWeight: (weight: number) => void;
  setLiftProgress: (progress: number) => void;
  setWindSpeed: (speed: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setSelectedView: (view: ViewMode) => void;
  setShowReportModal: (show: boolean) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  loadSampleScene: (scene: SampleScene['sceneData']) => void;
  resetScene: () => void;
  updateRisks: () => void;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  ...defaultScene,
  isPlaying: false,
  currentTime: 0,
  selectedView: 'free',
  showReportModal: false,
  leftPanelOpen: true,
  rightPanelOpen: true,

  setCraneAngle: (angle) =>
    set((state) => {
      const newState = { ...state, crane: { ...state.crane, currentAngle: angle } };
      return { ...newState, risks: detectRisks(newState) };
    }),

  setCraneRadius: (radius) =>
    set((state) => {
      const newState = { ...state, crane: { ...state.crane, currentRadius: radius } };
      return { ...newState, risks: detectRisks(newState) };
    }),

  setLiftWeight: (weight) =>
    set((state) => {
      const newState = { ...state, liftObject: { ...state.liftObject, weight } };
      return { ...newState, risks: detectRisks(newState) };
    }),

  setLiftProgress: (progress) =>
    set((state) => {
      const newState = {
        ...state,
        liftObject: { ...state.liftObject, currentProgress: Math.max(0, Math.min(1, progress)) },
      };
      return { ...newState, risks: detectRisks(newState) };
    }),

  setWindSpeed: (speed) =>
    set((state) => {
      const newState = { ...state, environment: { ...state.environment, windSpeed: speed } };
      return { ...newState, risks: detectRisks(newState) };
    }),

  setPlaying: (isPlaying) => set({ isPlaying }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setSelectedView: (view) => set({ selectedView: view }),

  setShowReportModal: (show) => set({ showReportModal: show }),

  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),

  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  loadSampleScene: (sceneData) =>
    set({
      ...sceneData,
      isPlaying: false,
      currentTime: 0,
      selectedView: 'free',
      showReportModal: false,
    }),

  resetScene: () =>
    set({
      ...defaultScene,
      isPlaying: false,
      currentTime: 0,
      selectedView: 'free',
      showReportModal: false,
    }),

  updateRisks: () => {
    const state = get();
    set({ risks: detectRisks(state) });
  },
}));

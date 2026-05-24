import { create } from 'zustand';
import {
  SceneData,
  LayerVisibility,
  PlaybackState,
  CameraPreset,
  CameraView,
  Point3D
} from '../types';
import { sampleSceneData } from '../data/sampleData';

interface SceneState {
  sceneData: SceneData | null;
  layerVisibility: LayerVisibility;
  playback: PlaybackState;
  selectedItemId: string | null;
  selectedItemType: string | null;
  cameraPreset: CameraPreset;
  cameraView: CameraView;
  isDataLoaded: boolean;

  loadSampleData: () => void;
  importSceneData: (data: SceneData) => void;
  resetScene: () => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  setLayerVisibility: (layer: keyof LayerVisibility, visible: boolean) => void;

  startPlayback: () => void;
  pausePlayback: () => void;
  setPlaybackTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  updatePlaybackTime: (deltaTime: number) => void;

  selectItem: (id: string | null, type: string | null) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setCameraView: (position: Point3D, target: Point3D) => void;
}

const initialLayerVisibility: LayerVisibility = {
  terrain: true,
  trajectories: true,
  fallPoints: true,
  rescueStations: true,
  riskZones: true,
  rescueRoutes: true
};

const initialPlayback: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 20000,
  speed: 1
};

const initialCameraView: CameraView = {
  position: { x: 80, y: 100, z: -80 },
  target: { x: 50, y: 0, z: 80 }
};

export const useSceneStore = create<SceneState>((set, get) => ({
  sceneData: null,
  layerVisibility: initialLayerVisibility,
  playback: initialPlayback,
  selectedItemId: null,
  selectedItemType: null,
  cameraPreset: 'overview',
  cameraView: initialCameraView,
  isDataLoaded: false,

  loadSampleData: () => {
    const maxTimestamp = Math.max(
      ...sampleSceneData.trajectories.flatMap(t => 
        t.points.map(p => p.timestamp)
      )
    );
    set({
      sceneData: sampleSceneData,
      playback: { ...initialPlayback, duration: maxTimestamp + 1000 },
      isDataLoaded: true
    });
  },

  importSceneData: (data: SceneData) => {
    const maxTimestamp = Math.max(
      ...data.trajectories.flatMap(t => t.points.map(p => p.timestamp))
    );
    set({
      sceneData: data,
      playback: { ...initialPlayback, duration: maxTimestamp + 1000 },
      isDataLoaded: true
    });
  },

  resetScene: () => {
    set({
      layerVisibility: initialLayerVisibility,
      playback: initialPlayback,
      selectedItemId: null,
      selectedItemType: null,
      cameraPreset: 'overview',
      cameraView: initialCameraView
    });
  },

  toggleLayer: (layer) => {
    set(state => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer]
      }
    }));
  },

  setLayerVisibility: (layer, visible) => {
    set(state => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: visible
      }
    }));
  },

  startPlayback: () => {
    set(state => ({
      playback: { ...state.playback, isPlaying: true }
    }));
  },

  pausePlayback: () => {
    set(state => ({
      playback: { ...state.playback, isPlaying: false }
    }));
  },

  setPlaybackTime: (time) => {
    set(state => ({
      playback: { ...state.playback, currentTime: time }
    }));
  },

  setPlaybackSpeed: (speed) => {
    set(state => ({
      playback: { ...state.playback, speed }
    }));
  },

  updatePlaybackTime: (deltaTime) => {
    const { playback } = get();
    if (!playback.isPlaying) return;
    
    const newTime = playback.currentTime + deltaTime * playback.speed;
    const clampedTime = Math.min(newTime, playback.duration);
    
    if (clampedTime >= playback.duration) {
      set(state => ({
        playback: { ...state.playback, currentTime: 0, isPlaying: false }
      }));
    } else {
      set(state => ({
        playback: { ...state.playback, currentTime: clampedTime }
      }));
    }
  },

  selectItem: (id, type) => {
    set({
      selectedItemId: id,
      selectedItemType: type
    });
  },

  setCameraPreset: (preset) => {
    set({ cameraPreset: preset });
  },

  setCameraView: (position, target) => {
    set({
      cameraView: { position, target }
    });
  }
}));

export default useSceneStore;

import { create } from 'zustand';
import {
  SceneData,
  LayerVisibility,
  PlaybackState,
  CameraPreset,
  CameraView,
  Point3D,
  RescueRoute,
  FallPoint
} from '../types';
import { sampleSceneData } from '../data/sampleData';
import { validateSceneData } from '../utils/dataValidator';

interface SceneState {
  sceneData: SceneData | null;
  layerVisibility: LayerVisibility;
  playback: PlaybackState;
  selectedItemId: string | null;
  selectedItemType: string | null;
  cameraPreset: CameraPreset;
  cameraView: CameraView;
  isDataLoaded: boolean;
  planningMode: boolean;
  plannedRoute: Point3D[] | null;

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

  togglePlanningMode: () => void;
  addRoutePoint: (point: Point3D) => void;
  clearPlannedRoute: () => void;
  savePlannedRoute: (name: string, fromStation: string, toPoint: string) => void;
  recomputeAllRoutes: () => void;
  revalidateData: () => void;
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
  planningMode: false,
  plannedRoute: null,

  loadSampleData: () => {
    const maxTimestamp = Math.max(
      ...sampleSceneData.trajectories.flatMap(t => 
        t.points.map(p => p.timestamp)
      )
    );
    const validation = validateSceneData(sampleSceneData);
    const sceneDataWithValidation = {
      ...sampleSceneData,
      validation
    };
    set({
      sceneData: sceneDataWithValidation,
      playback: { ...initialPlayback, duration: maxTimestamp + 1000 },
      isDataLoaded: true
    });
  },

  importSceneData: (data: SceneData) => {
    const maxTimestamp = Math.max(
      ...data.trajectories.flatMap(t => t.points.map(p => p.timestamp))
    );
    const validation = validateSceneData(data);
    const validatedData = {
      ...data,
      validation
    };
    set({
      sceneData: validatedData,
      playback: { ...initialPlayback, duration: maxTimestamp + 1000 },
      isDataLoaded: true
    });
  },

  revalidateData: () => {
    const { sceneData } = get();
    if (!sceneData) return;
    const validation = validateSceneData(sceneData);
    set(state => ({
      sceneData: {
        ...state.sceneData!,
        validation
      }
    }));
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
  },

  togglePlanningMode: () => {
    set(state => ({
      planningMode: !state.planningMode,
      plannedRoute: state.planningMode ? null : []
    }));
  },

  addRoutePoint: (point) => {
    set(state => {
      if (!state.planningMode) return state;
      const newRoute = state.plannedRoute ? [...state.plannedRoute, point] : [point];
      return { plannedRoute: newRoute };
    });
  },

  clearPlannedRoute: () => {
    set({ plannedRoute: [] });
  },

  savePlannedRoute: (name, fromStation, toPoint) => {
    const { sceneData, plannedRoute } = get();
    if (!sceneData || !plannedRoute || plannedRoute.length < 2) return;

    const newRoute: RescueRoute = {
      id: `route_${Date.now()}`,
      name,
      points: plannedRoute,
      fromStation,
      toPoint,
      estimatedTime: Math.round(plannedRoute.length * 2),
      color: '#165DFF'
    };

    const updatedData = {
      ...sceneData,
      rescueRoutes: [...sceneData.rescueRoutes, newRoute]
    };
    
    const validation = validateSceneData(updatedData);
    updatedData.validation = validation;

    set({
      sceneData: updatedData,
      planningMode: false,
      plannedRoute: null
    });
  },

  recomputeAllRoutes: () => {
    const { sceneData } = get();
    if (!sceneData) return;

    const recomputedRoutes = sceneData.rescueRoutes.map(route => {
      const startPoint = sceneData.rescueStations.find(s => s.name === route.fromStation);
      const endPoint = sceneData.fallPoints.find(f => f.id === route.toPoint);
      
      if (startPoint && endPoint) {
        const midX = (startPoint.position.x + endPoint.position.x) / 2;
        const midZ = (startPoint.position.z + endPoint.position.z) / 2;
        
        const newPoints = [
          { x: startPoint.position.x, y: 0, z: startPoint.position.z },
          { x: midX, y: 0, z: midZ },
          { x: endPoint.position.x, y: 0, z: endPoint.position.z }
        ];

        return {
          ...route,
          points: newPoints
        };
      }
      return route;
    });

    const updatedData = {
      ...sceneData,
      rescueRoutes: recomputedRoutes
    };
    
    const validation = validateSceneData(updatedData);
    updatedData.validation = validation;

    set({ sceneData: updatedData });
  }
}));

export default useSceneStore;

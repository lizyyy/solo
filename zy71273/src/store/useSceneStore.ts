import { create } from 'zustand';
import * as THREE from 'three';
import { SceneSettings } from '../types/colorSpace';

interface SceneState {
  settings: SceneSettings;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  isUserInteracting: boolean;
  zoomLevel: number;
  
  setAutoRotate: (enabled: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowAxes: (show: boolean) => void;
  setClusterMode: (mode: SceneSettings['clusterMode']) => void;
  setShowTrails: (show: boolean) => void;
  setBloomIntensity: (intensity: number) => void;
  setCameraPosition: (position: THREE.Vector3) => void;
  setCameraTarget: (target: THREE.Vector3) => void;
  setUserInteracting: (interacting: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  resetView: () => void;
  focusOnPosition: (position: THREE.Vector3) => void;
}

const defaultSettings: SceneSettings = {
  autoRotate: true,
  showGrid: true,
  showAxes: true,
  clusterMode: 'class',
  showTrails: false,
  bloomIntensity: 1.5
};

export const useSceneStore = create<SceneState>((set) => ({
  settings: defaultSettings,
  cameraPosition: new THREE.Vector3(0, 2, 5),
  cameraTarget: new THREE.Vector3(0, 0, 0),
  isUserInteracting: false,
  zoomLevel: 1,

  setAutoRotate: (enabled) => set(state => ({
    settings: { ...state.settings, autoRotate: enabled }
  })),

  setShowGrid: (show) => set(state => ({
    settings: { ...state.settings, showGrid: show }
  })),

  setShowAxes: (show) => set(state => ({
    settings: { ...state.settings, showAxes: show }
  })),

  setClusterMode: (mode) => set(state => ({
    settings: { ...state.settings, clusterMode: mode }
  })),

  setShowTrails: (show) => set(state => ({
    settings: { ...state.settings, showTrails: show }
  })),

  setBloomIntensity: (intensity) => set(state => ({
    settings: { ...state.settings, bloomIntensity: intensity }
  })),

  setCameraPosition: (position) => set({ cameraPosition: position }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
  setUserInteracting: (interacting) => set({ isUserInteracting: interacting }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  resetView: () => set({
    cameraPosition: new THREE.Vector3(0, 2, 5),
    cameraTarget: new THREE.Vector3(0, 0, 0),
    zoomLevel: 1
  }),

  focusOnPosition: (position) => {
    const offset = position.clone().normalize().multiplyScalar(3);
    const newPosition = position.clone().add(offset);
    set({
      cameraPosition: newPosition,
      cameraTarget: position.clone()
    });
  }
}));

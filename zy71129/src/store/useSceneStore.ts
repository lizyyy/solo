
import { create } from 'zustand';
import { Point3D } from '../types/model';

interface SceneState {
  cameraPosition: Point3D;
  cameraTarget: Point3D;
  isOrthographic: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showElevationLines: boolean;
  wireframeMode: boolean;
  autoRotate: boolean;
  
  setCameraPosition: (pos: Point3D) => void;
  setCameraTarget: (target: Point3D) => void;
  setIsOrthographic: (ortho: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowAxes: (show: boolean) => void;
  setShowElevationLines: (show: boolean) => void;
  setWireframeMode: (wireframe: boolean) => void;
  setAutoRotate: (auto: boolean) => void;
  resetCamera: () => void;
  fitCameraToObject: (position: Point3D) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  cameraPosition: { x: 25, y: 20, z: 25 },
  cameraTarget: { x: 0, y: 3, z: 0 },
  isOrthographic: false,
  showGrid: true,
  showAxes: true,
  showElevationLines: true,
  wireframeMode: false,
  autoRotate: false,

  setCameraPosition: (pos) => set({ cameraPosition: pos }),

  setCameraTarget: (target) => set({ cameraTarget: target }),

  setIsOrthographic: (ortho) => set({ isOrthographic: ortho }),

  setShowGrid: (show) => set({ showGrid: show }),

  setShowAxes: (show) => set({ showAxes: show }),

  setShowElevationLines: (show) => set({ showElevationLines: show }),

  setWireframeMode: (wireframe) => set({ wireframeMode: wireframe }),

  setAutoRotate: (auto) => set({ autoRotate: auto }),

  resetCamera: () => set({
    cameraPosition: { x: 25, y: 20, z: 25 },
    cameraTarget: { x: 0, y: 3, z: 0 }
  }),

  fitCameraToObject: (position) => set({
    cameraTarget: position,
    cameraPosition: {
      x: position.x + 15,
      y: position.y + 10,
      z: position.z + 15
    }
  })
}));

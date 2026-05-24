import type { CameraView } from '../types';

export interface CameraPosition {
  position: [number, number, number];
  target: [number, number, number];
}

export const cameraPresets: Record<CameraView, CameraPosition> = {
  overview: {
    position: [25, 20, 25],
    target: [0, 5, 0],
  },
  front: {
    position: [0, 10, 30],
    target: [0, 5, 0],
  },
  side: {
    position: [30, 10, 0],
    target: [0, 5, 0],
  },
  top: {
    position: [0, 35, 0.1],
    target: [0, 0, 0],
  },
  free: {
    position: [25, 20, 25],
    target: [0, 5, 0],
  },
};

export function getCameraPreset(view: CameraView): CameraPosition {
  return cameraPresets[view] || cameraPresets.overview;
}

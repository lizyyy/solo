import type { Viewpoint, Vec3 } from '../types';

const now = new Date();

export const DEFAULT_VIEWPOINTS: Viewpoint[] = [
  {
    id: 'vp-default',
    name: '默认视角',
    cameraPosition: [30, 20, 30],
    cameraTarget: [0, 0, 0],
    fov: 50,
    createdAt: now,
  },
  {
    id: 'vp-side',
    name: '侧视角度',
    cameraPosition: [50, 0, 0],
    cameraTarget: [0, 0, 0],
    fov: 60,
    createdAt: now,
  },
  {
    id: 'vp-top',
    name: '俯视角度',
    cameraPosition: [0, 50, 0],
    cameraTarget: [0, 0, 0],
    fov: 60,
    createdAt: now,
  },
  {
    id: 'vp-close',
    name: '近距离观察',
    cameraPosition: [15, 8, 15],
    cameraTarget: [0, 0, 0],
    fov: 45,
    createdAt: now,
  },
];

export const createViewpoint = (
  name: string,
  position: Vec3,
  target: Vec3,
  fov: number
): Viewpoint => ({
  id: `vp-${Date.now()}`,
  name,
  cameraPosition: position,
  cameraTarget: target,
  fov,
  createdAt: new Date(),
});

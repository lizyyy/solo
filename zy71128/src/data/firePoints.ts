import { FirePoint } from '../types';

export const FIRE_POINTS: FirePoint[] = [
  {
    id: 'fire-1',
    position: { x: -15, y: 12, z: -10 },
    intensity: 0.8,
    detected: true,
    timestamp: '2024-05-20 14:30:00'
  },
  {
    id: 'fire-2',
    position: { x: 20, y: 10, z: 15 },
    intensity: 0.5,
    detected: true,
    timestamp: '2024-05-20 15:15:00'
  },
  {
    id: 'fire-3',
    position: { x: -25, y: 8, z: 25 },
    intensity: 0.3,
    detected: false,
    timestamp: '2024-05-20 16:00:00'
  }
];

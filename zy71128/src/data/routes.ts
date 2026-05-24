import { PatrolRoute } from '../types';

export const PATROL_ROUTES: PatrolRoute[] = [
  {
    id: 'route-1',
    name: '北线巡护路线',
    color: '#43A047',
    enabled: true,
    coverageScore: 75,
    points: [
      { x: -30, y: 12, z: -30 },
      { x: -15, y: 15, z: -25 },
      { x: 0, y: 18, z: -20 },
      { x: 15, y: 14, z: -15 },
      { x: 30, y: 16, z: -10 }
    ]
  },
  {
    id: 'route-2',
    name: '南线巡护路线',
    color: '#1E88E5',
    enabled: true,
    coverageScore: 68,
    points: [
      { x: -25, y: 10, z: 25 },
      { x: -10, y: 12, z: 20 },
      { x: 5, y: 14, z: 15 },
      { x: 20, y: 11, z: 20 },
      { x: 35, y: 13, z: 25 }
    ]
  },
  {
    id: 'route-3',
    name: '环线补充路线',
    color: '#FF9800',
    enabled: false,
    coverageScore: 82,
    points: [
      { x: 0, y: 20, z: 0 },
      { x: 15, y: 18, z: -10 },
      { x: 20, y: 15, z: 10 },
      { x: 5, y: 16, z: 20 },
      { x: -15, y: 14, z: 10 },
      { x: -20, y: 17, z: -10 },
      { x: 0, y: 20, z: 0 }
    ]
  }
];

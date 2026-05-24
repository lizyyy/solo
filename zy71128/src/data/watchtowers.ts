import { Watchtower } from '../types';

export const WATCHTOWERS: Watchtower[] = [
  {
    id: 'tower-1',
    name: '主峰瞭望塔',
    position: { x: 0, y: 35, z: 0 },
    height: 15,
    viewDistance: 50,
    viewAngle: 360,
    enabled: true
  },
  {
    id: 'tower-2',
    name: '东峰瞭望塔',
    position: { x: 25, y: 25, z: -15 },
    height: 12,
    viewDistance: 40,
    viewAngle: 360,
    enabled: true
  },
  {
    id: 'tower-3',
    name: '西谷瞭望塔',
    position: { x: -20, y: 20, z: 20 },
    height: 10,
    viewDistance: 35,
    viewAngle: 360,
    enabled: true
  }
];

import type { BlackHole } from '../types';
import { calculateSchwarzschildRadius } from '../physics/constants';

const now = new Date();

export const DEFAULT_BLACK_HOLE: BlackHole = {
  id: 'bh-001',
  type: 'blackHole',
  mass: 10.0,
  schwarzschildRadius: calculateSchwarzschildRadius(10.0),
  spin: 0.0,
  dataSource: '模拟数据 v1.0',
  version: '1.0.0',
  createdAt: now,
  formula: 'R_s = 2GM/c²，其中G=6.67e-11 m³/(kg·s², M为黑洞质量, c为光速',
};

export const PRESET_BLACK_HOLES: BlackHole[] = [
  {
    id: 'bh-sagittarius',
    type: 'blackHole',
    mass: 4.3e6,
    schwarzschildRadius: calculateSchwarzschildRadius(4.3e6),
    spin: 0.9,
    dataSource: '银河系中心人马座A*观测数据',
    version: '2.1.0',
    createdAt: now,
    formula: 'R_s = 2GM/c²，基于事件视界望远镜2022年观测结果',
  },
  {
    id: 'bh-m87',
    type: 'blackHole',
    mass: 6.5e9,
    schwarzschildRadius: calculateSchwarzschildRadius(6.5e9),
    spin: 0.4,
    dataSource: 'M87星系中心黑洞',
    version: '1.5.0',
    createdAt: now,
    formula: 'R_s = 2GM/c²，基于事件视界望远镜2019年首张黑洞照片',
  },
];

export const generateBlackHole = (mass: number): BlackHole => ({
  id: `bh-${Date.now()}`,
  type: 'blackHole',
  mass,
  schwarzschildRadius: calculateSchwarzschildRadius(mass),
  spin: Math.random() * 0.9,
  dataSource: '用户自定义配置',
  version: '1.0.0',
  createdAt: new Date(),
  formula: 'R_s = 2GM/c²，用户自定义参数',
});

import type { ProjectData, SimulationConfig } from '../types';
import { generateId } from '../utils';

export const DEFAULT_CONFIG: SimulationConfig = {
  maxEvacuationDistance: 30,
  minAisleWidth: 1.5,
  checkBoothOverlap: true,
  checkExitAccessibility: true
};

export function createSampleProject(): ProjectData {
  const hallWidth = 40;
  const hallDepth = 30;
  
  return {
    id: generateId(),
    name: '示例展馆 - A 展厅',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exhibitionHall: {
      width: hallWidth,
      depth: hallDepth
    },
    config: { ...DEFAULT_CONFIG },
    booths: [
      {
        id: 'booth_1',
        name: '科技展区 A',
        position: { x: 5, z: 5 },
        dimension: { width: 6, depth: 4 },
        rotation: 0,
        color: '#3498db'
      },
      {
        id: 'booth_2',
        name: '科技展区 B',
        position: { x: 17, z: 5 },
        dimension: { width: 6, depth: 4 },
        rotation: 0,
        color: '#2ecc71'
      },
      {
        id: 'booth_3',
        name: '消费电子区',
        position: { x: 5, z: 18 },
        dimension: { width: 5, depth: 5 },
        rotation: 0,
        color: '#9b59b6'
      },
      {
        id: 'booth_4',
        name: '智能家居区',
        position: { x: 28, z: 10 },
        dimension: { width: 6, depth: 5 },
        rotation: 0,
        color: '#f39c12'
      },
      {
        id: 'booth_5',
        name: '游戏体验区',
        position: { x: 15, z: 20 },
        dimension: { width: 7, depth: 5 },
        rotation: 0,
        color: '#e74c3c'
      }
    ],
    exits: [
      {
        id: 'exit_1',
        name: '主入口',
        position: { x: hallWidth / 2, z: 0.5 },
        width: 3
      },
      {
        id: 'exit_2',
        name: '东侧出口',
        position: { x: hallWidth - 0.5, z: hallDepth / 2 },
        width: 2
      },
      {
        id: 'exit_3',
        name: '西侧出口',
        position: { x: 0.5, z: hallDepth / 2 },
        width: 2
      },
      {
        id: 'exit_4',
        name: '北侧出口',
        position: { x: hallWidth / 2, z: hallDepth - 0.5 },
        width: 3
      }
    ],
    zones: [
      {
        id: 'zone_1',
        name: '东展区',
        position: { x: 12, z: 2 },
        dimension: { width: 12, depth: 8 },
        color: 'rgba(52, 152, 219, 0.3)'
      },
      {
        id: 'zone_2',
        name: '中央展区',
        position: { x: 10, z: 12 },
        dimension: { width: 15, depth: 8 },
        color: 'rgba(46, 204, 113, 0.3)'
      },
      {
        id: 'zone_3',
        name: '西展区',
        position: { x: 2, z: 15 },
        dimension: { width: 10, depth: 10 },
        color: 'rgba(155, 89, 182, 0.3)'
      },
      {
        id: 'zone_4',
        name: '东南展区',
        position: { x: 25, z: 8 },
        dimension: { width: 10, depth: 10 },
        color: 'rgba(243, 156, 18, 0.3)'
      }
    ],
    evacuationPaths: [],
    validationResults: []
  };
}

export function createEmptyProject(name: string = '新项目'): ProjectData {
  return {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exhibitionHall: {
      width: 40,
      depth: 30
    },
    config: { ...DEFAULT_CONFIG },
    booths: [],
    exits: [],
    zones: [],
    evacuationPaths: [],
    validationResults: []
  };
}

export const BOOTH_COLORS = [
  '#3498db',
  '#2ecc71',
  '#9b59b6',
  '#f39c12',
  '#e74c3c',
  '#1abc9c',
  '#e67e22',
  '#34495e',
  '#16a085',
  '#d35400'
];

export const ZONE_COLORS = [
  'rgba(52, 152, 219, 0.3)',
  'rgba(46, 204, 113, 0.3)',
  'rgba(155, 89, 182, 0.3)',
  'rgba(243, 156, 18, 0.3)',
  'rgba(231, 76, 60, 0.3)',
  'rgba(26, 188, 156, 0.3)',
  'rgba(241, 196, 15, 0.3)',
  'rgba(52, 73, 94, 0.3)'
];

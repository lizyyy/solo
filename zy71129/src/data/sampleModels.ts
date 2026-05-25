
import { ModelElement, VersionInfo } from '../types/model';

export const versions: VersionInfo[] = [
  {
    number: 1,
    timestamp: Date.now() - 86400000 * 3,
    description: '初始设计版本',
    author: '张工'
  },
  {
    number: 2,
    timestamp: Date.now() - 86400000,
    description: '调整消防管线标高',
    author: '李工'
  }
];

const createId = () => Math.random().toString(36).substr(2, 9);

export const sampleModelsV1: ModelElement[] = [
  {
    id: 'ct-001',
    type: 'cable_tray',
    name: '强电桥架-A1',
    elevation: 3.2,
    radius: 0.3,
    version: 1,
    visible: true,
    color: '#165DFF',
    system: '强电系统',
    points: [
      { x: -10, y: 3.2, z: 0 },
      { x: -5, y: 3.2, z: 0 },
      { x: 0, y: 3.2, z: 5 },
      { x: 10, y: 3.2, z: 5 }
    ]
  },
  {
    id: 'ct-002',
    type: 'cable_tray',
    name: '弱电桥架-B1',
    elevation: 3.0,
    radius: 0.25,
    version: 1,
    visible: true,
    color: '#4080FF',
    system: '弱电系统',
    points: [
      { x: -8, y: 3.0, z: -8 },
      { x: -8, y: 3.0, z: 0 },
      { x: -8, y: 3.0, z: 8 }
    ]
  },
  {
    id: 'ct-003',
    type: 'cable_tray',
    name: '消防桥架-C1',
    elevation: 2.8,
    radius: 0.2,
    version: 1,
    visible: true,
    color: '#69B1FF',
    system: '消防系统',
    points: [
      { x: 5, y: 2.8, z: -10 },
      { x: 5, y: 2.8, z: -3 },
      { x: 5, y: 2.8, z: 5 }
    ]
  },
  {
    id: 'duct-001',
    type: 'duct',
    name: '送风管道-S1',
    elevation: 3.5,
    radius: 0.5,
    version: 1,
    visible: true,
    color: '#0FC6C2',
    system: '空调系统',
    points: [
      { x: -10, y: 3.5, z: -5 },
      { x: 0, y: 3.5, z: -5 },
      { x: 8, y: 3.5, z: -5 }
    ]
  },
  {
    id: 'duct-002',
    type: 'duct',
    name: '排风管道-P1',
    elevation: 3.3,
    radius: 0.4,
    version: 1,
    visible: true,
    color: '#14C9C9',
    system: '排风系统',
    points: [
      { x: -3, y: 3.3, z: -10 },
      { x: -3, y: 3.3, z: 0 },
      { x: 2, y: 3.3, z: 5 }
    ]
  },
  {
    id: 'duct-003',
    type: 'duct',
    name: '新风管道-X1',
    elevation: 3.1,
    radius: 0.35,
    version: 1,
    visible: true,
    color: '#2DD4D4',
    system: '新风系统',
    points: [
      { x: 8, y: 3.1, z: -8 },
      { x: 8, y: 3.1, z: 0 },
      { x: 3, y: 3.1, z: 8 }
    ]
  },
  {
    id: 'fire-001',
    type: 'fire_pipe',
    name: '消防喷淋-F1',
    elevation: 3.2,
    radius: 0.1,
    version: 1,
    visible: true,
    color: '#F53F3F',
    system: '喷淋系统',
    diameter: 150,
    points: [
      { x: 0, y: 3.2, z: -10 },
      { x: 0, y: 3.2, z: 0 },
      { x: 0, y: 3.2, z: 10 }
    ]
  },
  {
    id: 'fire-002',
    type: 'fire_pipe',
    name: '消火栓-F2',
    elevation: 2.9,
    radius: 0.08,
    version: 1,
    visible: true,
    color: '#F76560',
    system: '消火栓系统',
    diameter: 100,
    points: [
      { x: -6, y: 2.9, z: 5 },
      { x: 0, y: 2.9, z: 5 },
      { x: 6, y: 2.9, z: 5 }
    ]
  },
  {
    id: 'fire-003',
    type: 'fire_pipe',
    name: '消防主干-F3',
    elevation: 3.1,
    radius: 0.15,
    version: 1,
    visible: true,
    color: '#F53F3F',
    system: '喷淋系统',
    diameter: 200,
    points: [
      { x: -10, y: 3.1, z: -2 },
      { x: -5, y: 3.1, z: -2 },
      { x: 0, y: 3.1, z: -2 },
      { x: 5, y: 3.1, z: -2 },
      { x: 10, y: 3.1, z: -2 }
    ]
  }
];

export const sampleModelsV2: ModelElement[] = sampleModelsV1.map(m => ({
  ...m,
  version: 2,
  points: m.type === 'fire_pipe' && m.id === 'fire-001'
    ? m.points.map(p => ({ ...p, y: 3.6 }))
    : m.points,
  elevation: m.type === 'fire_pipe' && m.id === 'fire-001' ? 3.6 : m.elevation
}));

export const allSampleModels = [...sampleModelsV1, ...sampleModelsV2];

export const floorDimensions = {
  width: 30,
  depth: 25,
  height: 5
};

export const elevationMarkers = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5];

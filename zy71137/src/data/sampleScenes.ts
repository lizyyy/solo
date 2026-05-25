import { OrchardScene } from '@/types';

export const sampleScenes: OrchardScene[] = [
  {
    id: 'normal',
    name: '正常场景 - 安全喷药',
    description: '微风，风向背离邻田和水渠，药雾不会漂移到敏感区域',
    type: 'normal',
    orchard: {
      position: [0, 0, 0],
      size: [20, 20],
      treeRows: 5,
      treesPerRow: 5,
    },
    sprinklers: [
      { id: 's1', position: [-5, 4, -5], sprayRate: 50, dropletSize: 0.05 },
      { id: 's2', position: [5, 4, -5], sprayRate: 50, dropletSize: 0.05 },
      { id: 's3', position: [-5, 4, 5], sprayRate: 50, dropletSize: 0.05 },
      { id: 's4', position: [5, 4, 5], sprayRate: 50, dropletSize: 0.05 },
    ],
    canal: {
      position: [-18, 0, 0],
      size: [3, 40],
      flowDirection: 90,
    },
    adjacentFields: [
      {
        id: 'af1',
        name: '邻田A - 蔬菜大棚',
        position: [0, 0, 18],
        size: [20, 8],
        bufferZone: 5,
      },
      {
        id: 'af2',
        name: '邻田B - 有机农田',
        position: [0, 0, -18],
        size: [20, 8],
        bufferZone: 8,
      },
    ],
    defaultParams: {
      windSpeed: 2,
      windDirection: 180,
      pesticideType: 'organic',
      bufferThreshold: 0.1,
      simulationSpeed: 1,
    },
  },
  {
    id: 'conflict',
    name: '冲突场景 - 漂移风险',
    description: '强风，风向指向邻田和水渠，药雾会漂移到敏感区域触发报警',
    type: 'conflict',
    orchard: {
      position: [0, 0, 0],
      size: [20, 20],
      treeRows: 5,
      treesPerRow: 5,
    },
    sprinklers: [
      { id: 's1', position: [-5, 4, -5], sprayRate: 80, dropletSize: 0.03 },
      { id: 's2', position: [5, 4, -5], sprayRate: 80, dropletSize: 0.03 },
      { id: 's3', position: [-5, 4, 5], sprayRate: 80, dropletSize: 0.03 },
      { id: 's4', position: [5, 4, 5], sprayRate: 80, dropletSize: 0.03 },
    ],
    canal: {
      position: [18, 0, 0],
      size: [3, 40],
      flowDirection: 270,
    },
    adjacentFields: [
      {
        id: 'af1',
        name: '邻田A - 蔬菜大棚',
        position: [0, 0, 18],
        size: [20, 8],
        bufferZone: 5,
      },
      {
        id: 'af2',
        name: '邻田B - 有机农田',
        position: [0, 0, -18],
        size: [20, 8],
        bufferZone: 8,
      },
    ],
    defaultParams: {
      windSpeed: 8,
      windDirection: 90,
      pesticideType: 'herbicide',
      bufferThreshold: 0.1,
      simulationSpeed: 1,
    },
  },
  {
    id: 'empty',
    name: '空结果场景 - 无风沉降',
    description: '无风或极微风，药雾仅在地块内沉降，几乎无漂移',
    type: 'empty',
    orchard: {
      position: [0, 0, 0],
      size: [20, 20],
      treeRows: 5,
      treesPerRow: 5,
    },
    sprinklers: [
      { id: 's1', position: [-5, 4, -5], sprayRate: 60, dropletSize: 0.08 },
      { id: 's2', position: [5, 4, -5], sprayRate: 60, dropletSize: 0.08 },
      { id: 's3', position: [-5, 4, 5], sprayRate: 60, dropletSize: 0.08 },
      { id: 's4', position: [5, 4, 5], sprayRate: 60, dropletSize: 0.08 },
    ],
    canal: {
      position: [-18, 0, 0],
      size: [3, 40],
      flowDirection: 90,
    },
    adjacentFields: [
      {
        id: 'af1',
        name: '邻田A - 蔬菜大棚',
        position: [0, 0, 18],
        size: [20, 8],
        bufferZone: 5,
      },
      {
        id: 'af2',
        name: '邻田B - 有机农田',
        position: [0, 0, -18],
        size: [20, 8],
        bufferZone: 8,
      },
    ],
    defaultParams: {
      windSpeed: 0.5,
      windDirection: 45,
      pesticideType: 'fungicide',
      bufferThreshold: 0.1,
      simulationSpeed: 1,
    },
  },
];
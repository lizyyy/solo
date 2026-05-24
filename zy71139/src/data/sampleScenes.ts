import { Scene } from '../types';

export const sampleScenes: Scene[] = [
  {
    id: 'scene-1',
    name: '双洞隧道中段火灾',
    description: '隧道中段车辆起火，需正确操作风机引导烟气向出口排放，保护逃生通道',
    tunnelLength: 100,
    fans: [
      {
        id: 'fan-1',
        name: '入口风机 A',
        position: { x: -40, y: 3, z: 0 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'inlet'
      },
      {
        id: 'fan-2',
        name: '入口风机 B',
        position: { x: -30, y: 3, z: 8 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'inlet'
      },
      {
        id: 'fan-3',
        name: '中段风机 A',
        position: { x: 0, y: 3, z: 0 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'middle'
      },
      {
        id: 'fan-4',
        name: '中段风机 B',
        position: { x: 10, y: 3, z: 8 },
        direction: 'backward',
        isOn: false,
        power: 100,
        zone: 'middle'
      },
      {
        id: 'fan-5',
        name: '出口风机 A',
        position: { x: 35, y: 3, z: 0 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'outlet'
      },
      {
        id: 'fan-6',
        name: '出口风机 B',
        position: { x: 45, y: 3, z: 8 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'outlet'
      }
    ],
    escapeRoutes: [
      {
        id: 'escape-1',
        name: '左侧逃生通道',
        position: { x: -20, y: 0, z: -12 },
        isBlocked: false
      },
      {
        id: 'escape-2',
        name: '右侧逃生通道',
        position: { x: 20, y: 0, z: -12 },
        isBlocked: false
      }
    ],
    smokeSources: [
      {
        position: { x: 0, y: 1, z: 4 },
        intensity: 1.0,
        active: true
      }
    ],
    vehicles: [
      {
        id: 'car-1',
        position: { x: -5, y: 0.5, z: 2 },
        direction: 1
      },
      {
        id: 'car-2',
        position: { x: -15, y: 0.5, z: 6 },
        direction: 1
      },
      {
        id: 'car-3',
        position: { x: 15, y: 0.5, z: 2 },
        direction: -1
      }
    ]
  },
  {
    id: 'scene-2',
    name: '长隧道多火源场景',
    description: '长隧道内多处起火，需分区控制风机，确保逃生通道安全',
    tunnelLength: 150,
    fans: [
      {
        id: 'fan-1',
        name: 'A区风机',
        position: { x: -60, y: 3, z: 0 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'inlet'
      },
      {
        id: 'fan-2',
        name: 'B区风机',
        position: { x: -20, y: 3, z: 0 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'middle'
      },
      {
        id: 'fan-3',
        name: 'C区风机',
        position: { x: 20, y: 3, z: 0 },
        direction: 'backward',
        isOn: false,
        power: 100,
        zone: 'middle'
      },
      {
        id: 'fan-4',
        name: 'D区风机',
        position: { x: 60, y: 3, z: 0 },
        direction: 'forward',
        isOn: false,
        power: 100,
        zone: 'outlet'
      }
    ],
    escapeRoutes: [
      {
        id: 'escape-1',
        name: '逃生通道 1',
        position: { x: -40, y: 0, z: -12 },
        isBlocked: false
      },
      {
        id: 'escape-2',
        name: '逃生通道 2',
        position: { x: 0, y: 0, z: -12 },
        isBlocked: false
      },
      {
        id: 'escape-3',
        name: '逃生通道 3',
        position: { x: 40, y: 0, z: -12 },
        isBlocked: false
      }
    ],
    smokeSources: [
      {
        position: { x: -30, y: 1, z: 4 },
        intensity: 0.8,
        active: true
      },
      {
        position: { x: 30, y: 1, z: 4 },
        intensity: 0.6,
        active: true
      }
    ],
    vehicles: [
      {
        id: 'car-1',
        position: { x: -50, y: 0.5, z: 2 },
        direction: 1
      },
      {
        id: 'car-2',
        position: { x: 10, y: 0.5, z: 6 },
        direction: 1
      },
      {
        id: 'car-3',
        position: { x: 50, y: 0.5, z: 2 },
        direction: -1
      }
    ]
  },
  {
    id: 'scene-3',
    name: '入口火灾紧急疏散',
    description: '隧道入口处起火，需反向操作风机将烟气排出入口，保护内部人员',
    tunnelLength: 80,
    fans: [
      {
        id: 'fan-1',
        name: '入口风机',
        position: { x: -30, y: 3, z: 4 },
        direction: 'backward',
        isOn: false,
        power: 100,
        zone: 'inlet'
      },
      {
        id: 'fan-2',
        name: '中段风机',
        position: { x: 0, y: 3, z: 4 },
        direction: 'backward',
        isOn: false,
        power: 100,
        zone: 'middle'
      },
      {
        id: 'fan-3',
        name: '出口风机',
        position: { x: 30, y: 3, z: 4 },
        direction: 'backward',
        isOn: false,
        power: 100,
        zone: 'outlet'
      }
    ],
    escapeRoutes: [
      {
        id: 'escape-1',
        name: '紧急出口',
        position: { x: 20, y: 0, z: -12 },
        isBlocked: false
      }
    ],
    smokeSources: [
      {
        position: { x: -35, y: 1, z: 4 },
        intensity: 1.0,
        active: true
      }
    ],
    vehicles: [
      {
        id: 'car-1',
        position: { x: -20, y: 0.5, z: 2 },
        direction: 1
      },
      {
        id: 'car-2',
        position: { x: -10, y: 0.5, z: 6 },
        direction: 1
      },
      {
        id: 'car-3',
        position: { x: 10, y: 0.5, z: 2 },
        direction: 1
      }
    ]
  }
];

import { Light, ForbiddenZone, ProgramSegment } from '../types';

export const sampleLights: Light[] = [
  {
    id: 'light-1',
    name: '面光 1#',
    type: 'spot',
    position: { x: -4, y: 6, z: -8 },
    target: { x: -2, y: 1, z: 0 },
    beamAngle: 25,
    intensity: 0.8,
    color: '#ffffff',
    enabled: true,
    group: '面光'
  },
  {
    id: 'light-2',
    name: '面光 2#',
    type: 'spot',
    position: { x: 0, y: 6, z: -8 },
    target: { x: 0, y: 1, z: 0 },
    beamAngle: 25,
    intensity: 0.8,
    color: '#ffffff',
    enabled: true,
    group: '面光'
  },
  {
    id: 'light-3',
    name: '面光 3#',
    type: 'spot',
    position: { x: 4, y: 6, z: -8 },
    target: { x: 2, y: 1, z: 0 },
    beamAngle: 25,
    intensity: 0.8,
    color: '#ffffff',
    enabled: true,
    group: '面光'
  },
  {
    id: 'light-4',
    name: '侧光 1#',
    type: 'par',
    position: { x: -8, y: 4, z: -2 },
    target: { x: -3, y: 1, z: 0 },
    beamAngle: 35,
    intensity: 0.6,
    color: '#ff6b6b',
    enabled: true,
    group: '侧光'
  },
  {
    id: 'light-5',
    name: '侧光 2#',
    type: 'par',
    position: { x: 8, y: 4, z: -2 },
    target: { x: 3, y: 1, z: 0 },
    beamAngle: 35,
    intensity: 0.6,
    color: '#4ecdc4',
    enabled: true,
    group: '侧光'
  },
  {
    id: 'light-6',
    name: '观众区测试灯',
    type: 'spot',
    position: { x: 0, y: 5, z: -5 },
    target: { x: 0, y: 2, z: 8 },
    beamAngle: 30,
    intensity: 0.7,
    color: '#ff0000',
    enabled: true,
    group: '测试'
  },
  {
    id: 'light-7',
    name: '字幕屏测试灯',
    type: 'par',
    position: { x: 2, y: 4, z: -4 },
    target: { x: 0, y: 5, z: 2 },
    beamAngle: 20,
    intensity: 0.5,
    color: '#ffff00',
    enabled: true,
    group: '测试'
  },
  {
    id: 'light-8',
    name: '追光 1#',
    type: 'moving',
    position: { x: -6, y: 7, z: -6 },
    target: { x: -1, y: 1, z: 1 },
    beamAngle: 15,
    intensity: 1.0,
    color: '#ffffff',
    enabled: false,
    group: '特效'
  }
];

export const sampleForbiddenZones: ForbiddenZone[] = [
  {
    id: 'zone-audience',
    name: '观众区域',
    type: 'audience',
    bounds: {
      min: { x: -10, y: 0, z: 4 },
      max: { x: 10, y: 3, z: 12 }
    },
    color: 'rgba(255, 149, 0, 0.15)'
  },
  {
    id: 'zone-subtitle',
    name: '字幕屏区域',
    type: 'subtitle',
    bounds: {
      min: { x: -3, y: 4, z: 1.5 },
      max: { x: 3, y: 5.5, z: 1.8 }
    },
    color: 'rgba(255, 59, 48, 0.15)'
  }
];

export const sampleProgramSegments: ProgramSegment[] = [
  {
    id: 'seg-1',
    name: '开场',
    startTime: 0,
    endTime: 30,
    lightStates: [
      { lightId: 'light-1', position: { x: -4, y: 6, z: -8 }, target: { x: -2, y: 1, z: 0 }, intensity: 0.8 },
      { lightId: 'light-2', position: { x: 0, y: 6, z: -8 }, target: { x: 0, y: 1, z: 0 }, intensity: 0.8 },
      { lightId: 'light-3', position: { x: 4, y: 6, z: -8 }, target: { x: 2, y: 1, z: 0 }, intensity: 0.8 }
    ]
  },
  {
    id: 'seg-2',
    name: '表演段落 A',
    startTime: 30,
    endTime: 60,
    lightStates: [
      { lightId: 'light-1', position: { x: -4, y: 6, z: -8 }, target: { x: -3, y: 1, z: 1 }, intensity: 0.6 },
      { lightId: 'light-2', position: { x: 0, y: 6, z: -8 }, target: { x: 0, y: 1, z: 1 }, intensity: 0.6 },
      { lightId: 'light-3', position: { x: 4, y: 6, z: -8 }, target: { x: 3, y: 1, z: 1 }, intensity: 0.6 },
      { lightId: 'light-4', position: { x: -8, y: 4, z: -2 }, target: { x: -3, y: 1, z: 0 }, intensity: 0.8 },
      { lightId: 'light-5', position: { x: 8, y: 4, z: -2 }, target: { x: 3, y: 1, z: 0 }, intensity: 0.8 }
    ]
  },
  {
    id: 'seg-3',
    name: '表演段落 B',
    startTime: 60,
    endTime: 90,
    lightStates: [
      { lightId: 'light-1', position: { x: -4, y: 6, z: -8 }, target: { x: -1, y: 2, z: 2 }, intensity: 0.5 },
      { lightId: 'light-3', position: { x: 4, y: 6, z: -8 }, target: { x: 1, y: 2, z: 2 }, intensity: 0.5 },
      { lightId: 'light-8', position: { x: -6, y: 7, z: -6 }, target: { x: 0, y: 1, z: 0 }, intensity: 1.0 }
    ]
  },
  {
    id: 'seg-4',
    name: '谢幕',
    startTime: 90,
    endTime: 100,
    lightStates: [
      { lightId: 'light-1', position: { x: -4, y: 6, z: -8 }, target: { x: 0, y: 1, z: 0 }, intensity: 1.0 },
      { lightId: 'light-2', position: { x: 0, y: 6, z: -8 }, target: { x: 0, y: 1, z: 0 }, intensity: 1.0 },
      { lightId: 'light-3', position: { x: 4, y: 6, z: -8 }, target: { x: 0, y: 1, z: 0 }, intensity: 1.0 }
    ]
  }
];

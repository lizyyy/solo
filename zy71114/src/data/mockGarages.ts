import { Garage, Vehicle, CameraPreset } from '../types';

export const mockGarages: Garage[] = [
  {
    id: 'garage-001',
    name: '商场A座地下车库',
    entrances: [
      {
        id: 'entrance-001',
        name: '东入口',
        position: [-15, 0, 0],
        minHeight: 2.2,
        hasSign: true,
      },
      {
        id: 'entrance-002',
        name: '西入口',
        position: [15, 0, 0],
        minHeight: 2.4,
        hasSign: false,
      },
    ],
    ramps: [
      {
        id: 'ramp-001',
        points: [
          [-15, 0, 0],
          [-10, 0.5, 5],
          [-5, 1.0, 10],
          [0, 1.5, 15],
          [5, 2.0, 20],
          [10, 2.0, 25],
          [15, 2.0, 30],
        ],
        width: 6,
        slope: 0.1,
        transitionPoints: [
          {
            id: 'tp-001',
            position: [0, 1.5, 15],
            measuredHeight: 2.1,
            riskLevel: 'danger',
          },
          {
            id: 'tp-002',
            position: [5, 2.0, 20],
            measuredHeight: 2.3,
            riskLevel: 'warning',
          },
        ],
      },
    ],
    beams: [
      {
        id: 'beam-001',
        position: [0, 3.6, 15],
        size: [8, 0.5, 1],
        bottomHeight: 3.35,
      },
      {
        id: 'beam-002',
        position: [5, 4.3, 20],
        size: [8, 0.5, 1],
        bottomHeight: 4.05,
      },
      {
        id: 'beam-003',
        position: [-8, 3.0, 3],
        size: [6, 0.4, 0.8],
        bottomHeight: 2.8,
      },
    ],
    signs: [
      {
        id: 'sign-001',
        entranceId: 'entrance-001',
        position: [-15, 2.8, -3],
        height: 2.2,
        text: '限高2.2米',
      },
    ],
  },
  {
    id: 'garage-002',
    name: '购物中心B区车库',
    entrances: [
      {
        id: 'entrance-003',
        name: '主入口',
        position: [0, 0, -20],
        minHeight: 2.5,
        hasSign: true,
      },
    ],
    ramps: [
      {
        id: 'ramp-002',
        points: [
          [0, 0, -20],
          [0, 0.8, -10],
          [0, 1.6, 0],
          [0, 2.4, 10],
          [0, 3.0, 20],
        ],
        width: 7,
        slope: 0.08,
        transitionPoints: [
          {
            id: 'tp-003',
            position: [0, 1.6, 0],
            measuredHeight: 2.6,
            riskLevel: 'safe',
          },
        ],
      },
    ],
    beams: [
      {
        id: 'beam-004',
        position: [0, 4.5, 0],
        size: [10, 0.6, 1.2],
        bottomHeight: 4.2,
      },
    ],
    signs: [
      {
        id: 'sign-002',
        entranceId: 'entrance-003',
        position: [0, 3.2, -23],
        height: 2.5,
        text: '限高2.5米',
      },
    ],
  },
];

export const mockVehicles: Vehicle[] = [
  {
    id: 'vehicle-001',
    name: '普通轿车',
    type: 'car',
    height: 1.5,
    width: 1.8,
    length: 4.5,
    unit: 'm',
  },
  {
    id: 'vehicle-002',
    name: 'SUV越野车',
    type: 'suv',
    height: 1.9,
    width: 2.0,
    length: 4.8,
    unit: 'm',
  },
  {
    id: 'vehicle-003',
    name: '商务面包车',
    type: 'van',
    height: 2.2,
    width: 2.0,
    length: 5.2,
    unit: 'm',
  },
  {
    id: 'vehicle-004',
    name: '小型货车',
    type: 'truck',
    height: 2.8,
    width: 2.2,
    length: 6.0,
    unit: 'm',
  },
];

export const cameraPresets: CameraPreset[] = [
  {
    id: 'overview',
    name: '全局视角',
    position: [0, 15, -25],
    target: [0, 2, 10],
  },
  {
    id: 'entrance',
    name: '入口视角',
    position: [-20, 5, 0],
    target: [-10, 2, 10],
  },
  {
    id: 'ramp',
    name: '坡道视角',
    position: [0, 8, 5],
    target: [0, 2, 15],
  },
  {
    id: 'closeup',
    name: '细节视角',
    position: [-5, 4, 10],
    target: [0, 2, 15],
  },
];

export const defaultGarage = mockGarages[0];
export const defaultVehicle = mockVehicles[1];

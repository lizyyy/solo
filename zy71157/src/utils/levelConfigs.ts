import type { LevelConfig, ConveyorSegment, Flight } from '@/types/game';

const createConveyorSegments = (
  segments: Array<{ id: string; start: [number, number]; end: [number, number]; isSwitch?: boolean; switchOptions?: string[] }>,
  speed: number
): Omit<ConveyorSegment, 'currentSwitchTarget'>[] => {
  return segments.map(s => ({
    id: s.id,
    start: { x: s.start[0], z: s.start[1] },
    end: { x: s.end[0], z: s.end[1] },
    speed,
    isSwitch: s.isSwitch || false,
    switchOptions: s.switchOptions,
  }));
};

const baseFlights = [
  { number: 'CA1234', gate: 'A1', departureTime: 45, destination: '北京', airline: '国航' },
  { number: 'MU5678', gate: 'A2', departureTime: 50, destination: '上海', airline: '东航' },
  { number: 'CZ9012', gate: 'B1', departureTime: 55, destination: '广州', airline: '南航' },
  { number: 'HU3456', gate: 'B2', departureTime: 60, destination: '深圳', airline: '海航' },
];

const mediumFlights = [
  ...baseFlights,
  { number: '3U7890', gate: 'C1', departureTime: 40, destination: '成都', airline: '川航' },
  { number: 'SC2345', gate: 'C2', departureTime: 35, destination: '重庆', airline: '山航' },
];

const hardFlights = [
  ...mediumFlights,
  { number: 'FM6789', gate: 'D1', departureTime: 30, destination: '杭州', airline: '上航' },
  { number: 'ZH0123', gate: 'D2', departureTime: 25, destination: '西安', airline: '深航' },
];

export const levelConfigs: LevelConfig[] = [
  {
    id: 1,
    name: '初出茅庐',
    description: '熟悉基本操作，学习分拣普通行李到对应航班口',
    difficulty: 'easy',
    timeLimit: 180,
    baggageSpawnRate: 4.5,
    baggageSpeed: 2.2,
    baggageTypes: ['normal'],
    hasOversize: false,
    hasTransfer: false,
    hasDelays: false,
    passConditions: {
      minAccuracy: 0.80,
      maxErrors: 5,
    },
    flights: baseFlights,
    conveyorSegments: createConveyorSegments([
      { id: 'main1', start: [0, 8], end: [0, 4] },
      { id: 'main2', start: [0, 4], end: [0, 1] },
      { id: 'switch_main', start: [0, 1], end: [0, 0], isSwitch: true, switchOptions: ['path_left', 'path_right'] },
      { id: 'path_left', start: [0, 0], end: [-4, 0] },
      { id: 'path_right', start: [0, 0], end: [4, 0] },
      { id: 'switch_left', start: [-4, 0], end: [-4, -1], isSwitch: true, switchOptions: ['branch_a1', 'branch_a2'] },
      { id: 'switch_right', start: [4, 0], end: [4, -1], isSwitch: true, switchOptions: ['branch_b1', 'branch_b2'] },
      { id: 'branch_a1', start: [-4, -1], end: [-6, -3] },
      { id: 'branch_a2', start: [-4, -1], end: [-2, -3] },
      { id: 'branch_b1', start: [4, -1], end: [2, -3] },
      { id: 'branch_b2', start: [4, -1], end: [6, -3] },
    ], 2.2),
    spawnPoint: { x: 0, z: 8 },
    gates: [
      { id: 'A1', position: { x: -6, z: -3 }, type: 'normal' },
      { id: 'A2', position: { x: -2, z: -3 }, type: 'normal' },
      { id: 'B1', position: { x: 2, z: -3 }, type: 'normal' },
      { id: 'B2', position: { x: 6, z: -3 }, type: 'normal' },
    ],
    switches: [
      { id: 'switch_main', position: { x: 0, z: 0.5 }, options: ['A区', 'B区'] },
      { id: 'switch_left', position: { x: -4, z: -0.5 }, options: ['A1', 'A2'] },
      { id: 'switch_right', position: { x: 4, z: -0.5 }, options: ['B1', 'B2'] },
    ],
  },
  {
    id: 2,
    name: '繁忙时段',
    description: '处理转机行李和延误航班，注意转机时间压力',
    difficulty: 'medium',
    timeLimit: 240,
    baggageSpawnRate: 3.2,
    baggageSpeed: 2.6,
    baggageTypes: ['normal', 'transfer'],
    hasOversize: false,
    hasTransfer: true,
    hasDelays: true,
    passConditions: {
      minAccuracy: 0.75,
      maxErrors: 8,
      maxTransferTimeouts: 3,
    },
    flights: mediumFlights,
    conveyorSegments: createConveyorSegments([
      { id: 'main1', start: [0, 10], end: [0, 6] },
      { id: 'main2', start: [0, 6], end: [0, 3] },
      { id: 'switch_main', start: [0, 3], end: [0, 2], isSwitch: true, switchOptions: ['path_left', 'path_mid', 'path_right', 'path_storage'] },
      { id: 'path_left', start: [0, 2], end: [-5, 2] },
      { id: 'path_mid', start: [0, 2], end: [0, -1] },
      { id: 'path_right', start: [0, 2], end: [5, 2] },
      { id: 'path_storage', start: [0, 2], end: [8, 6] },
      { id: 'switch_left', start: [-5, 2], end: [-5, 1], isSwitch: true, switchOptions: ['branch_a1', 'branch_a2'] },
      { id: 'switch_mid', start: [0, -1], end: [0, -2], isSwitch: true, switchOptions: ['branch_c1', 'branch_c2'] },
      { id: 'switch_right', start: [5, 2], end: [5, 1], isSwitch: true, switchOptions: ['branch_b1', 'branch_b2'] },
      { id: 'branch_a1', start: [-5, 1], end: [-7, -1] },
      { id: 'branch_a2', start: [-5, 1], end: [-3, -1] },
      { id: 'branch_b1', start: [5, 1], end: [3, -1] },
      { id: 'branch_b2', start: [5, 1], end: [7, -1] },
      { id: 'branch_c1', start: [0, -2], end: [-3, -4] },
      { id: 'branch_c2', start: [0, -2], end: [3, -4] },
    ], 2.6),
    spawnPoint: { x: 0, z: 10 },
    gates: [
      { id: 'A1', position: { x: -7, z: -1 }, type: 'normal' },
      { id: 'A2', position: { x: -3, z: -1 }, type: 'normal' },
      { id: 'B1', position: { x: 3, z: -1 }, type: 'normal' },
      { id: 'B2', position: { x: 7, z: -1 }, type: 'normal' },
      { id: 'C1', position: { x: -3, z: -4 }, type: 'normal' },
      { id: 'C2', position: { x: 3, z: -4 }, type: 'normal' },
      { id: 'STORAGE', position: { x: 8, z: 6 }, type: 'storage' },
    ],
    switches: [
      { id: 'switch_main', position: { x: 0, z: 2.5 }, options: ['A区', 'C区', 'B区', '转存'] },
      { id: 'switch_left', position: { x: -5, z: 1.5 }, options: ['A1', 'A2'] },
      { id: 'switch_mid', position: { x: 0, z: -1.5 }, options: ['C1', 'C2'] },
      { id: 'switch_right', position: { x: 5, z: 1.5 }, options: ['B1', 'B2'] },
    ],
  },
  {
    id: 3,
    name: '复杂工况',
    description: '全规则启用，处理超规行李、转机、延误和取消航班',
    difficulty: 'hard',
    timeLimit: 300,
    baggageSpawnRate: 2.5,
    baggageSpeed: 3.0,
    baggageTypes: ['normal', 'transfer', 'oversize'],
    hasOversize: true,
    hasTransfer: true,
    hasDelays: true,
    passConditions: {
      minAccuracy: 0.70,
      maxErrors: 12,
      maxTransferTimeouts: 5,
      maxOversizeErrors: 3,
    },
    flights: hardFlights,
    conveyorSegments: createConveyorSegments([
      { id: 'main1', start: [0, 12], end: [0, 9] },
      { id: 'switch_oversize', start: [0, 9], end: [0, 8], isSwitch: true, switchOptions: ['main2', 'path_oversize'] },
      { id: 'main2', start: [0, 8], end: [0, 5] },
      { id: 'path_oversize', start: [0, 8], end: [8, 10] },
      { id: 'switch_main', start: [0, 5], end: [0, 4], isSwitch: true, switchOptions: ['path_ab', 'path_cd', 'path_storage'] },
      { id: 'path_ab', start: [0, 4], end: [0, 1] },
      { id: 'path_cd', start: [0, 4], end: [0, -3] },
      { id: 'path_storage', start: [0, 4], end: [10, 6] },
      { id: 'switch_ab', start: [0, 1], end: [0, 0], isSwitch: true, switchOptions: ['path_a', 'path_b'] },
      { id: 'path_a', start: [0, 0], end: [-6, 0] },
      { id: 'path_b', start: [0, 0], end: [6, 0] },
      { id: 'switch_cd', start: [0, -3], end: [0, -4], isSwitch: true, switchOptions: ['path_c', 'path_d'] },
      { id: 'path_c', start: [0, -4], end: [-6, -4] },
      { id: 'path_d', start: [0, -4], end: [6, -4] },
      { id: 'switch_a', start: [-6, 0], end: [-6, -1], isSwitch: true, switchOptions: ['branch_a1', 'branch_a2'] },
      { id: 'switch_b', start: [6, 0], end: [6, -1], isSwitch: true, switchOptions: ['branch_b1', 'branch_b2'] },
      { id: 'switch_c', start: [-6, -4], end: [-6, -5], isSwitch: true, switchOptions: ['branch_c1', 'branch_c2'] },
      { id: 'switch_d', start: [6, -4], end: [6, -5], isSwitch: true, switchOptions: ['branch_d1', 'branch_d2'] },
      { id: 'branch_a1', start: [-6, -1], end: [-8, -3] },
      { id: 'branch_a2', start: [-6, -1], end: [-4, -3] },
      { id: 'branch_b1', start: [6, -1], end: [4, -3] },
      { id: 'branch_b2', start: [6, -1], end: [8, -3] },
      { id: 'branch_c1', start: [-6, -5], end: [-8, -7] },
      { id: 'branch_c2', start: [-6, -5], end: [-4, -7] },
      { id: 'branch_d1', start: [6, -5], end: [4, -7] },
      { id: 'branch_d2', start: [6, -5], end: [8, -7] },
    ], 3.0),
    spawnPoint: { x: 0, z: 12 },
    gates: [
      { id: 'A1', position: { x: -8, z: -3 }, type: 'normal' },
      { id: 'A2', position: { x: -4, z: -3 }, type: 'normal' },
      { id: 'B1', position: { x: 4, z: -3 }, type: 'normal' },
      { id: 'B2', position: { x: 8, z: -3 }, type: 'normal' },
      { id: 'C1', position: { x: -8, z: -7 }, type: 'normal' },
      { id: 'C2', position: { x: -4, z: -7 }, type: 'normal' },
      { id: 'D1', position: { x: 4, z: -7 }, type: 'normal' },
      { id: 'D2', position: { x: 8, z: -7 }, type: 'normal' },
      { id: 'OVERSIZE', position: { x: 8, z: 10 }, type: 'oversize' },
      { id: 'STORAGE', position: { x: 10, z: 6 }, type: 'storage' },
    ],
    switches: [
      { id: 'switch_oversize', position: { x: 0, z: 8.5 }, options: ['普通', '超规'] },
      { id: 'switch_main', position: { x: 0, z: 4.5 }, options: ['AB区', 'CD区', '转存'] },
      { id: 'switch_ab', position: { x: 0, z: 0.5 }, options: ['A区', 'B区'] },
      { id: 'switch_cd', position: { x: 0, z: -3.5 }, options: ['C区', 'D区'] },
      { id: 'switch_a', position: { x: -6, z: -0.5 }, options: ['A1', 'A2'] },
      { id: 'switch_b', position: { x: 6, z: -0.5 }, options: ['B1', 'B2'] },
      { id: 'switch_c', position: { x: -6, z: -4.5 }, options: ['C1', 'C2'] },
      { id: 'switch_d', position: { x: 6, z: -4.5 }, options: ['D1', 'D2'] },
    ],
  },
];

export const getLevelConfig = (id: number): LevelConfig | undefined => {
  return levelConfigs.find(l => l.id === id);
};

export const getGateForFlight = (flightNumber: string, level: LevelConfig): string | undefined => {
  const flight = level.flights.find(f => f.number === flightNumber);
  return flight?.gate;
};

export const isGateOversize = (gateId: string): boolean => {
  return gateId === 'OVERSIZE';
};

export const isGateStorage = (gateId: string): boolean => {
  return gateId === 'STORAGE';
};

export const BAGGAGE_COLORS: Record<string, string> = {
  normal: '#3B82F6',
  transfer: '#F97316',
  oversize: '#EF4444',
};

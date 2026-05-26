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
      { id: 'main2', start: [0, 4], end: [0, 0] },
      { id: 'main3', start: [0, 0], end: [0, -4] },
      { id: 'switch1', start: [0, -4], end: [-4, -6], isSwitch: true, switchOptions: ['branch1a', 'branch1b'] },
      { id: 'switch2', start: [0, 0], end: [4, -2], isSwitch: true, switchOptions: ['branch2a', 'branch2b'] },
      { id: 'branch1a', start: [-4, -6], end: [-6, -8] },
      { id: 'branch1b', start: [-4, -6], end: [-2, -8] },
      { id: 'branch2a', start: [4, -2], end: [6, -4] },
      { id: 'branch2b', start: [4, -2], end: [2, -4] },
    ], 2.2),
    spawnPoint: { x: 0, z: 8 },
    gates: [
      { id: 'A1', position: { x: -6, z: -8 }, type: 'normal' },
      { id: 'A2', position: { x: -2, z: -8 }, type: 'normal' },
      { id: 'B1', position: { x: 2, z: -4 }, type: 'normal' },
      { id: 'B2', position: { x: 6, z: -4 }, type: 'normal' },
    ],
    switches: [
      { id: 'switch1', position: { x: 0, z: -4 }, options: ['A1', 'A2'] },
      { id: 'switch2', position: { x: 0, z: 0 }, options: ['B1', 'B2'] },
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
      { id: 'main2', start: [0, 6], end: [0, 2] },
      { id: 'main3', start: [0, 2], end: [0, -2] },
      { id: 'main4', start: [0, -2], end: [0, -6] },
      { id: 'switch1', start: [0, 2], end: [-5, 0], isSwitch: true, switchOptions: ['branch1a', 'branch1b'] },
      { id: 'switch2', start: [0, -2], end: [5, -4], isSwitch: true, switchOptions: ['branch2a', 'branch2b'] },
      { id: 'switch3', start: [0, -6], end: [0, -8], isSwitch: true, switchOptions: ['branch3a', 'branch3b'] },
      { id: 'branch1a', start: [-5, 0], end: [-7, -2] },
      { id: 'branch1b', start: [-5, 0], end: [-3, -2] },
      { id: 'branch2a', start: [5, -4], end: [7, -6] },
      { id: 'branch2b', start: [5, -4], end: [3, -6] },
      { id: 'branch3a', start: [0, -8], end: [-3, -10] },
      { id: 'branch3b', start: [0, -8], end: [3, -10] },
    ], 2.6),
    spawnPoint: { x: 0, z: 10 },
    gates: [
      { id: 'A1', position: { x: -7, z: -2 }, type: 'normal' },
      { id: 'A2', position: { x: -3, z: -2 }, type: 'normal' },
      { id: 'B1', position: { x: 3, z: -6 }, type: 'normal' },
      { id: 'B2', position: { x: 7, z: -6 }, type: 'normal' },
      { id: 'C1', position: { x: -3, z: -10 }, type: 'normal' },
      { id: 'C2', position: { x: 3, z: -10 }, type: 'normal' },
      { id: 'STORAGE', position: { x: 8, z: 8 }, type: 'storage' },
    ],
    switches: [
      { id: 'switch1', position: { x: 0, z: 2 }, options: ['A1', 'A2'] },
      { id: 'switch2', position: { x: 0, z: -2 }, options: ['B1', 'B2'] },
      { id: 'switch3', position: { x: 0, z: -6 }, options: ['C1', 'C2'] },
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
      { id: 'main1', start: [0, 12], end: [0, 8] },
      { id: 'main2', start: [0, 8], end: [0, 4] },
      { id: 'main3', start: [0, 4], end: [0, 0] },
      { id: 'main4', start: [0, 0], end: [0, -4] },
      { id: 'main5', start: [0, -4], end: [0, -8] },
      { id: 'oversize_branch', start: [0, 8], end: [6, 10] },
      { id: 'switch1', start: [0, 4], end: [-6, 2], isSwitch: true, switchOptions: ['branch1a', 'branch1b'] },
      { id: 'switch2', start: [0, 0], end: [6, -2], isSwitch: true, switchOptions: ['branch2a', 'branch2b'] },
      { id: 'switch3', start: [0, -4], end: [-6, -6], isSwitch: true, switchOptions: ['branch3a', 'branch3b'] },
      { id: 'switch4', start: [0, -8], end: [0, -10], isSwitch: true, switchOptions: ['branch4a', 'branch4b'] },
      { id: 'branch1a', start: [-6, 2], end: [-8, 0] },
      { id: 'branch1b', start: [-6, 2], end: [-4, 0] },
      { id: 'branch2a', start: [6, -2], end: [8, -4] },
      { id: 'branch2b', start: [6, -2], end: [4, -4] },
      { id: 'branch3a', start: [-6, -6], end: [-8, -8] },
      { id: 'branch3b', start: [-6, -6], end: [-4, -8] },
      { id: 'branch4a', start: [0, -10], end: [-3, -12] },
      { id: 'branch4b', start: [0, -10], end: [3, -12] },
      { id: 'oversize_end', start: [6, 10], end: [10, 10] },
    ], 3.0),
    spawnPoint: { x: 0, z: 12 },
    gates: [
      { id: 'A1', position: { x: -8, z: 0 }, type: 'normal' },
      { id: 'A2', position: { x: -4, z: 0 }, type: 'normal' },
      { id: 'B1', position: { x: 4, z: -4 }, type: 'normal' },
      { id: 'B2', position: { x: 8, z: -4 }, type: 'normal' },
      { id: 'C1', position: { x: -8, z: -8 }, type: 'normal' },
      { id: 'C2', position: { x: -4, z: -8 }, type: 'normal' },
      { id: 'D1', position: { x: -3, z: -12 }, type: 'normal' },
      { id: 'D2', position: { x: 3, z: -12 }, type: 'normal' },
      { id: 'OVERSIZE', position: { x: 10, z: 10 }, type: 'oversize' },
      { id: 'STORAGE', position: { x: 10, z: 0 }, type: 'storage' },
    ],
    switches: [
      { id: 'switch1', position: { x: 0, z: 4 }, options: ['A1', 'A2'] },
      { id: 'switch2', position: { x: 0, z: 0 }, options: ['B1', 'B2'] },
      { id: 'switch3', position: { x: 0, z: -4 }, options: ['C1', 'C2'] },
      { id: 'switch4', position: { x: 0, z: -8 }, options: ['D1', 'D2'] },
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

import type { ShootingSchedule } from '../types';

export const sampleSchedule: ShootingSchedule = {
  id: 'sample-001',
  name: '商业广告拍摄 - 日间外景',
  date: '2026-05-03',
  cameras: [
    { id: 'cam-1', name: 'Sony A7 IV #1', powerConsumption: 10, compatibleBatteryTypes: ['NP-FZ100'] },
    { id: 'cam-2', name: 'Sony A7 IV #2', powerConsumption: 10, compatibleBatteryTypes: ['NP-FZ100'] },
    { id: 'cam-3', name: 'Canon R6 Mark II', powerConsumption: 8, compatibleBatteryTypes: ['LP-E6NH'] },
  ],
  batteries: [
    { id: 'bat-1', name: 'FZ100 #1', type: 'NP-FZ100', capacity: 100, initialCharge: 100, currentCharge: 100, status: 'idle' },
    { id: 'bat-2', name: 'FZ100 #2', type: 'NP-FZ100', capacity: 100, initialCharge: 100, currentCharge: 100, status: 'idle' },
    { id: 'bat-3', name: 'FZ100 #3', type: 'NP-FZ100', capacity: 100, initialCharge: 85, currentCharge: 85, status: 'idle' },
    { id: 'bat-4', name: 'FZ100 #4', type: 'NP-FZ100', capacity: 100, initialCharge: 100, currentCharge: 100, status: 'idle' },
    { id: 'bat-5', name: 'LP-E6NH #1', type: 'LP-E6NH', capacity: 100, initialCharge: 100, currentCharge: 100, status: 'idle' },
    { id: 'bat-6', name: 'LP-E6NH #2', type: 'LP-E6NH', capacity: 100, initialCharge: 100, currentCharge: 100, status: 'idle' },
  ],
  chargers: [
    {
      id: 'charger-1',
      name: '索尼双充',
      ports: [
        { id: 'port-1', chargerId: 'charger-1', name: 'A口', compatibleBatteryTypes: ['NP-FZ100'], chargingSpeed: 20 },
        { id: 'port-2', chargerId: 'charger-1', name: 'B口', compatibleBatteryTypes: ['NP-FZ100'], chargingSpeed: 20 },
      ],
    },
    {
      id: 'charger-2',
      name: '佳能单充',
      ports: [
        { id: 'port-3', chargerId: 'charger-2', name: 'A口', compatibleBatteryTypes: ['LP-E6NH'], chargingSpeed: 15 },
      ],
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      name: '开场 - 产品展示',
      timeRange: { start: { hour: 9, minute: 0 }, end: { hour: 10, minute: 30 } },
      cameras: [
        { cameraId: 'cam-1', batteryId: 'bat-1' },
        { cameraId: 'cam-2', batteryId: 'bat-2' },
      ],
      notes: '主镜头 + 侧机位',
    },
    {
      id: 'scene-2',
      name: '场景二 - 模特使用',
      timeRange: { start: { hour: 10, minute: 45 }, end: { hour: 12, minute: 0 } },
      cameras: [
        { cameraId: 'cam-1', batteryId: 'bat-3' },
        { cameraId: 'cam-3', batteryId: 'bat-5' },
      ],
      notes: '换电池 bat-1, bat-2 充电',
    },
    {
      id: 'scene-3',
      name: '午休 - 器材充电',
      timeRange: { start: { hour: 12, minute: 0 }, end: { hour: 13, minute: 30 } },
      cameras: [],
      notes: '所有电池充电时间',
    },
    {
      id: 'scene-4',
      name: '场景三 - 细节特写',
      timeRange: { start: { hour: 13, minute: 30 }, end: { hour: 15, minute: 30 } },
      cameras: [
        { cameraId: 'cam-1', batteryId: 'bat-1' },
        { cameraId: 'cam-2', batteryId: 'bat-2' },
        { cameraId: 'cam-3', batteryId: 'bat-5' },
      ],
      notes: '三台同时使用',
    },
    {
      id: 'scene-5',
      name: '夜戏 - 户外场景',
      timeRange: { start: { hour: 22, minute: 0 }, end: { hour: 1, minute: 0 } },
      cameras: [
        { cameraId: 'cam-1', batteryId: 'bat-4' },
        { cameraId: 'cam-2', batteryId: 'bat-1' },
      ],
      notes: '跨午夜拍摄 - 注意监控电量',
    },
  ],
};

export const sampleMidnightSchedule: ShootingSchedule = {
  id: 'sample-002',
  name: '夜景延时 - 跨午夜',
  date: '2026-05-03',
  cameras: [
    { id: 'cam-1', name: 'Sony A7 IV #1', powerConsumption: 12, compatibleBatteryTypes: ['NP-FZ100'] },
    { id: 'cam-2', name: 'Canon R5', powerConsumption: 15, compatibleBatteryTypes: ['LP-E6NH'] },
  ],
  batteries: [
    { id: 'bat-1', name: 'FZ100 #1', type: 'NP-FZ100', capacity: 100, initialCharge: 100, currentCharge: 100, status: 'idle' },
    { id: 'bat-2', name: 'FZ100 #2', type: 'NP-FZ100', capacity: 100, initialCharge: 50, currentCharge: 50, status: 'charging', chargingPort: 'port-1' },
    { id: 'bat-3', name: 'LP-E6NH #1', type: 'LP-E6NH', capacity: 100, initialCharge: 100, currentCharge: 100, status: 'idle' },
    { id: 'bat-4', name: 'LP-E6NH #2', type: 'LP-E6NH', capacity: 100, initialCharge: 30, currentCharge: 30, status: 'low' },
  ],
  chargers: [
    {
      id: 'charger-1',
      name: '索尼单充',
      ports: [
        { id: 'port-1', chargerId: 'charger-1', name: 'A口', compatibleBatteryTypes: ['NP-FZ100'], chargingSpeed: 25 },
      ],
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      name: '日落延时',
      timeRange: { start: { hour: 17, minute: 0 }, end: { hour: 19, minute: 30 } },
      cameras: [
        { cameraId: 'cam-1', batteryId: 'bat-1' },
        { cameraId: 'cam-2', batteryId: 'bat-3' },
      ],
    },
    {
      id: 'scene-2',
      name: '蓝调时刻',
      timeRange: { start: { hour: 19, minute: 0 }, end: { hour: 20, minute: 0 } },
      cameras: [
        { cameraId: 'cam-1', batteryId: 'bat-1' },
        { cameraId: 'cam-2', batteryId: 'bat-3' },
      ],
      notes: '与前一场景重叠时间 - 潜在冲突',
    },
    {
      id: 'scene-3',
      name: '星空延时 - 深夜',
      timeRange: { start: { hour: 22, minute: 0 }, end: { hour: 2, minute: 0 } },
      cameras: [
        { cameraId: 'cam-1', batteryId: 'bat-2' },
        { cameraId: 'cam-2', batteryId: 'bat-4' },
      ],
      notes: '跨午夜 - 电量可能不足',
    },
  ],
};

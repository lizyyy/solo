import { Zone } from '../types/simulation';
import { Escalator, Turnstile, Platform } from '../types/devices';

export const STATION_ID = 'STATION_001';
export const STATION_NAME = '国贸换乘站';

export const zones: Zone[] = [
  {
    id: 'concourse_main',
    name: '主站厅',
    type: 'concourse',
    capacity: 800,
    position: [0, 0, 0],
    size: [20, 0.2, 15],
  },
  {
    id: 'platform_line1',
    name: '1号线站台',
    type: 'platform',
    capacity: 500,
    position: [0, -3, 25],
    size: [25, 0.2, 8],
  },
  {
    id: 'platform_line10',
    name: '10号线站台',
    type: 'platform',
    capacity: 500,
    position: [0, -6, -25],
    size: [25, 0.2, 8],
  },
  {
    id: 'escalator_group_a',
    name: 'A组扶梯（1号线）',
    type: 'escalator',
    capacity: 120,
    position: [-8, -1.5, 15],
    size: [3, 3, 10],
  },
  {
    id: 'escalator_group_b',
    name: 'B组扶梯（10号线）',
    type: 'escalator',
    capacity: 120,
    position: [8, -4.5, -15],
    size: [3, 3, 10],
  },
  {
    id: 'turnstile_north',
    name: '北侧闸机群',
    type: 'turnstile',
    capacity: 200,
    position: [0, 0, 10],
    size: [12, 0.2, 2],
  },
  {
    id: 'turnstile_south',
    name: '南侧闸机群',
    type: 'turnstile',
    capacity: 200,
    position: [0, 0, -10],
    size: [12, 0.2, 2],
  },
  {
    id: 'corridor_main',
    name: '主通道',
    type: 'corridor',
    capacity: 300,
    position: [0, 0, 0],
    size: [8, 0.2, 20],
  },
];

export const escalators: Escalator[] = [
  {
    id: 'esc_1_1',
    name: '1号线扶梯1号',
    position: [-10, -1.5, 15],
    direction: 'up',
    speed: 0.5,
    expectedDirection: 'up',
    hasMaintenanceRecord: false,
  },
  {
    id: 'esc_1_2',
    name: '1号线扶梯2号',
    position: [-6, -1.5, 15],
    direction: 'up',
    speed: 0.5,
    expectedDirection: 'up',
    hasMaintenanceRecord: false,
  },
  {
    id: 'esc_1_3',
    name: '1号线扶梯3号',
    position: [-2, -1.5, 15],
    direction: 'down',
    speed: 0.5,
    expectedDirection: 'up',
    hasMaintenanceRecord: false,
  },
  {
    id: 'esc_10_1',
    name: '10号线扶梯1号',
    position: [2, -4.5, -15],
    direction: 'up',
    speed: 0.5,
    expectedDirection: 'up',
    hasMaintenanceRecord: false,
  },
  {
    id: 'esc_10_2',
    name: '10号线扶梯2号',
    position: [6, -4.5, -15],
    direction: 'stopped',
    speed: 0,
    expectedDirection: 'up',
    hasMaintenanceRecord: false,
  },
  {
    id: 'esc_10_3',
    name: '10号线扶梯3号',
    position: [10, -4.5, -15],
    direction: 'up',
    speed: 0.5,
    expectedDirection: 'up',
    hasMaintenanceRecord: false,
  },
];

export const turnstiles: Turnstile[] = [
  { id: 'ts_n_1', name: '北闸机1号', position: [-5, 0.1, 10], status: 'open', throughput: 25, queueLength: 8 },
  { id: 'ts_n_2', name: '北闸机2号', position: [-3, 0.1, 10], status: 'open', throughput: 28, queueLength: 12 },
  { id: 'ts_n_3', name: '北闸机3号', position: [-1, 0.1, 10], status: 'open', throughput: 30, queueLength: 15 },
  { id: 'ts_n_4', name: '北闸机4号', position: [1, 0.1, 10], status: 'open', throughput: 30, queueLength: 14 },
  { id: 'ts_n_5', name: '北闸机5号', position: [3, 0.1, 10], status: 'open', throughput: 27, queueLength: 10 },
  { id: 'ts_n_6', name: '北闸机6号', position: [5, 0.1, 10], status: 'fault', throughput: 0, queueLength: 0 },
  { id: 'ts_s_1', name: '南闸机1号', position: [-5, 0.1, -10], status: 'open', throughput: 20, queueLength: 5 },
  { id: 'ts_s_2', name: '南闸机2号', position: [-3, 0.1, -10], status: 'open', throughput: 22, queueLength: 6 },
  { id: 'ts_s_3', name: '南闸机3号', position: [-1, 0.1, -10], status: 'open', throughput: 24, queueLength: 7 },
  { id: 'ts_s_4', name: '南闸机4号', position: [1, 0.1, -10], status: 'open', throughput: 23, queueLength: 6 },
  { id: 'ts_s_5', name: '南闸机5号', position: [3, 0.1, -10], status: 'open', throughput: 21, queueLength: 5 },
  { id: 'ts_s_6', name: '南闸机6号', position: [5, 0.1, -10], status: 'closed', throughput: 0, queueLength: 0 },
];

export const platforms: Platform[] = [
  {
    id: 'platform_line1',
    name: '1号线站台',
    position: [0, -3, 25],
    size: [25, 0.2, 8],
    capacity: 500,
    line: '1号线',
  },
  {
    id: 'platform_line10',
    name: '10号线站台',
    position: [0, -6, -25],
    size: [25, 0.2, 8],
    capacity: 500,
    line: '10号线',
  },
];

export const peakHourConfig = {
  startTime: '07:00',
  endTime: '09:30',
  expectedEscalatorDirection: 'up' as const,
};

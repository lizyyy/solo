import type { OrderWave, CongestionReport } from '../types';

const now = Date.now();

export const mockOrderWaves: OrderWave[] = [
  {
    id: 'wave-1',
    name: '早班波次-08:00',
    startTime: now - 8 * 3600000,
    endTime: now - 5 * 3600000,
    orderCount: 156,
    skuList: ['SKU-001', 'SKU-003', 'SKU-007', 'SKU-012', 'SKU-015'],
    priority: 1,
    isDataComplete: true,
  },
  {
    id: 'wave-2',
    name: '中班波次-12:00',
    startTime: now - 4 * 3600000,
    endTime: now - 2 * 3600000,
    orderCount: 203,
    skuList: ['SKU-002', 'SKU-005', 'SKU-008', 'SKU-010', 'SKU-018'],
    priority: 2,
    isDataComplete: true,
  },
  {
    id: 'wave-3',
    name: '晚班波次-18:00',
    startTime: now - 1 * 3600000,
    endTime: now + 2 * 3600000,
    orderCount: 178,
    skuList: ['SKU-004', 'SKU-006', 'SKU-009', 'SKU-011', 'SKU-020'],
    priority: 1,
    isDataComplete: false,
  },
  {
    id: 'wave-4',
    name: '夜间波次-22:00',
    startTime: now + 3 * 3600000,
    endTime: now + 6 * 3600000,
    orderCount: 89,
    skuList: ['SKU-013', 'SKU-014', 'SKU-016', 'SKU-017', 'SKU-019'],
    priority: 3,
    isDataComplete: true,
  },
];

const shelfIds = Array.from({ length: 60 }, (_, i) => `shelf-1-${i}`);

export const mockCongestionReports: CongestionReport[] = [
  {
    id: 'congestion-1',
    shelfId: 'shelf-1-15',
    startTime: now - 3 * 3600000,
    endTime: now - 2.5 * 3600000,
    reason: '高热度SKU集中',
    robotCount: 5,
    avgWaitTime: 45,
    isManuallyModified: false,
  },
  {
    id: 'congestion-2',
    shelfId: 'shelf-1-28',
    startTime: now - 2 * 3600000,
    endTime: now - 1.5 * 3600000,
    reason: '路径交汇点',
    robotCount: 3,
    avgWaitTime: 28,
    isManuallyModified: false,
  },
  {
    id: 'congestion-3',
    shelfId: 'shelf-1-42',
    startTime: now - 1 * 3600000,
    endTime: now - 0.5 * 3600000,
    reason: '补货作业占用',
    robotCount: 4,
    avgWaitTime: 35,
    isManuallyModified: true,
  },
  {
    id: 'congestion-4',
    shelfId: 'shelf-1-8',
    startTime: now - 4 * 3600000,
    endTime: now - 3.5 * 3600000,
    reason: '拣选任务集中',
    robotCount: 6,
    avgWaitTime: 52,
    isManuallyModified: false,
  },
  ...shelfIds.slice(10, 50).filter((_, i) => i % 7 === 0).map((shelfId, i) => ({
    id: `congestion-auto-${i}`,
    shelfId,
    startTime: now - (2 + i * 0.5) * 3600000,
    endTime: now - (1.5 + i * 0.5) * 3600000,
    reason: '常规流量',
    robotCount: Math.floor(Math.random() * 3) + 1,
    avgWaitTime: Math.floor(Math.random() * 20) + 5,
    isManuallyModified: false,
  })),
];

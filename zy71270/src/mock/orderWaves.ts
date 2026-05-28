import type { OrderWave } from '../types';

const BASE_TIME = Date.now() - 7200000;

const waveNames = [
  '早高峰波次-01',
  '午间补货波次-02',
  '下午分拣波次-03',
  '晚高峰波次-04',
  '夜间盘点波次-05',
];

const generateSkuList = (count: number, startIndex: number): string[] => {
  return Array.from({ length: count }, (_, i) =>
    `SKU-${String(startIndex * 100 + i * 7).padStart(6, '0')}`
  );
};

export const orderWaves: OrderWave[] = [
  {
    id: 'wave-001',
    name: waveNames[0],
    startTime: BASE_TIME,
    endTime: BASE_TIME + 3600000,
    orderCount: 256,
    skuList: generateSkuList(45, 1),
    priority: 1,
    isDataComplete: true,
  },
  {
    id: 'wave-002',
    name: waveNames[1],
    startTime: BASE_TIME + 3600000,
    endTime: BASE_TIME + 5400000,
    orderCount: 128,
    skuList: generateSkuList(32, 2),
    priority: 2,
    isDataComplete: true,
  },
  {
    id: 'wave-003',
    name: waveNames[2],
    startTime: BASE_TIME + 5400000,
    endTime: BASE_TIME + 7200000,
    orderCount: 312,
    skuList: generateSkuList(58, 3),
    priority: 1,
    isDataComplete: false,
  },
  {
    id: 'wave-004',
    name: waveNames[3],
    startTime: BASE_TIME + 7200000,
    endTime: BASE_TIME + 9000000,
    orderCount: 445,
    skuList: generateSkuList(62, 4),
    priority: 1,
    isDataComplete: true,
  },
  {
    id: 'wave-005',
    name: waveNames[4],
    startTime: BASE_TIME + 9000000,
    endTime: BASE_TIME + 10800000,
    orderCount: 89,
    skuList: generateSkuList(15, 5),
    priority: 3,
    isDataComplete: true,
  },
];

orderWaves[2].skuList = orderWaves[2].skuList.slice(0, 20);

orderWaves[3].endTime = 0;

orderWaves[4].skuList = [];

export const getActiveWave = (timestamp: number): OrderWave | null => {
  return orderWaves.find(w => w.startTime <= timestamp && w.endTime >= timestamp) || null;
};

export const getWavesByPriority = (priority: number): OrderWave[] => {
  return orderWaves.filter(w => w.priority === priority).sort((a, b) => a.startTime - b.startTime);
};

export const getIncompleteWaves = (): OrderWave[] => {
  return orderWaves.filter(w => !w.isDataComplete);
};

export const getWaveBySku = (sku: string): OrderWave[] => {
  return orderWaves.filter(w => w.skuList.includes(sku));
};

export default orderWaves;

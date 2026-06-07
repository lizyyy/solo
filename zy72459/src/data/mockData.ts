import { NightSamplingPoint, ResidentComplaint } from '@/types';
import dayjs from 'dayjs';
import { generateId } from '@/utils/helpers';

export const mockSamplingPoints: NightSamplingPoint[] = [
  {
    id: generateId(),
    pointCode: 'ZM-001',
    location: '人民路与建设路交叉口东北角',
    illumination: 12,
    hasRamp: false,
    score: 24,
    importTime: dayjs().toISOString(),
    importBatch: 'BATCH-20240601'
  },
  {
    id: generateId(),
    pointCode: 'ZM-002',
    location: '中山路与解放路交叉口东南角',
    illumination: 8,
    hasRamp: true,
    score: 1,
    importTime: dayjs().toISOString(),
    importBatch: 'BATCH-20240601'
  },
  {
    id: generateId(),
    pointCode: 'ZM-003',
    location: '和平路与文化路交叉口西侧',
    illumination: 25,
    hasRamp: false,
    score: 50,
    importTime: dayjs().toISOString(),
    importBatch: 'BATCH-20240601'
  },
  {
    id: generateId(),
    pointCode: 'ZM-004',
    location: '光明路与幸福街交叉口北侧',
    illumination: 5,
    hasRamp: true,
    score: 0,
    importTime: dayjs().toISOString(),
    importBatch: 'BATCH-20240601'
  },
  {
    id: generateId(),
    pointCode: 'ZM-005',
    location: '长江路与泰山路交叉口东侧',
    illumination: 18,
    hasRamp: false,
    score: 36,
    importTime: dayjs().toISOString(),
    importBatch: 'BATCH-20240601'
  }
];

export const mockComplaints: ResidentComplaint[] = [
  {
    id: generateId(),
    complaintCode: 'TS-2024-001',
    pointCode: 'ZM-001',
    location: '人民路与建设路交叉口东北角',
    description: '该路口夜间照明严重不足，老人小孩出行不安全',
    reportTime: dayjs().subtract(1, 'day').toISOString()
  },
  {
    id: generateId(),
    complaintCode: 'TS-2024-002',
    pointCode: 'ZM-002',
    location: '中山路与解放路交叉口东南角',
    description: '坡道处灯光太暗，多次有人摔倒',
    reportTime: dayjs().subtract(2, 'day').toISOString()
  },
  {
    id: generateId(),
    complaintCode: 'TS-2024-003',
    pointCode: 'ZM-004',
    location: '光明路与幸福街交叉口北侧坡道',
    description: '照明严重不足，存在安全隐患',
    reportTime: dayjs().subtract(3, 'day').toISOString()
  },
  {
    id: generateId(),
    complaintCode: 'TS-2024-004',
    pointCode: 'ZM-003',
    location: '和平路与文化路交叉口东侧',
    description: '路灯时亮时不亮，严重影响通行',
    reportTime: dayjs().subtract(1, 'day').toISOString()
  }
];

export const duplicateSamplingPoint: NightSamplingPoint = {
  id: generateId(),
  pointCode: 'ZM-001',
  location: '人民路与建设路交叉口东北角',
  illumination: 15,
  hasRamp: false,
  score: 30,
  importTime: dayjs().toISOString(),
  importBatch: 'BATCH-20240602'
};

import type { JunctionPhoto, BusCardRecord, CommunityNameMap, ConflictRecord, OperationLog } from '@/types';
import { generateId, formatDateTime, generateBatchId } from './common';

const COMMUNITIES = [
  '阳光花园',
  '阳光花园小区',
  '锦绣家园',
  '锦绣家园东区',
  '幸福里',
  '幸福里社区',
  '和平苑',
  '和平苑小区',
  '康乐新村',
  '康乐新村一期',
  '安泰花园',
  '安泰花园西区'
];

const JUNCTIONS = [
  '东门路口',
  '西门路口',
  '南门路口',
  '北门路口',
  '主干道交叉口',
  '人行横道处'
];

const TIME_SLOTS = [
  '07:00-08:00',
  '08:00-09:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00'
];

export function generateMockPhotos(count: number = 8): JunctionPhoto[] {
  const batch = generateBatchId();
  const photos: JunctionPhoto[] = [];
  
  for (let i = 0; i < count; i++) {
    const communityIndex = i % COMMUNITIES.length;
    const junctionIndex = i % JUNCTIONS.length;
    const hour = 7 + (i % 3);
    
    photos.push({
      id: generateId(),
      fileName: `路口照片_${i + 1}.jpg`,
      uploadTime: formatDateTime(),
      junctionName: JUNCTIONS[junctionIndex],
      communityName: COMMUNITIES[communityIndex],
      photoTime: `2025-06-05 ${hour.toString().padStart(2, '0')}:30:00`,
      hasCrosswalk: Math.random() > 0.3,
      hasTrafficLight: Math.random() > 0.5,
      importBatch: batch,
      note: i === 3 ? '人行横道标线模糊' : undefined
    });
  }
  
  return photos;
}

export function generateMockBusRecords(count: number = 12): BusCardRecord[] {
  const batch = generateBatchId();
  const records: BusCardRecord[] = [];
  
  for (let i = 0; i < count; i++) {
    const communityIndex = i % COMMUNITIES.length;
    const slotIndex = i % TIME_SLOTS.length;
    
    records.push({
      id: generateId(),
      communityName: COMMUNITIES[communityIndex],
      timeSlot: TIME_SLOTS[slotIndex],
      cardCount: Math.floor(Math.random() * 80) + 5,
      recordDate: '2025-06-05',
      importBatch: batch,
      isSupplementary: i >= 10
    });
  }
  
  return records;
}

export function generateMockNameMaps(): CommunityNameMap[] {
  return [
    {
      id: generateId(),
      oldName: '阳光花园',
      newName: '阳光花园小区',
      status: 'pending',
      source: 'auto-detect',
      similarity: 0.85,
      reviewedAt: formatDateTime()
    },
    {
      id: generateId(),
      oldName: '锦绣家园',
      newName: '锦绣家园东区',
      status: 'pending',
      source: 'auto-detect',
      similarity: 0.8,
      reviewedAt: formatDateTime()
    },
    {
      id: generateId(),
      oldName: '幸福里',
      newName: '幸福里社区',
      status: 'confirmed',
      source: 'manual',
      reviewedBy: '市政巡检员-李',
      reviewedAt: formatDateTime()
    }
  ];
}

export function generateMockLogs(): OperationLog[] {
  return [
    {
      id: generateId(),
      timestamp: formatDateTime(new Date(Date.now() - 3600000)),
      operator: '交通协管-老马',
      action: '导入照片',
      targetType: 'JunctionPhoto',
      targetId: 'batch-001',
      detail: '批量导入 8 张路口照片'
    },
    {
      id: generateId(),
      timestamp: formatDateTime(new Date(Date.now() - 1800000)),
      operator: '交通协管-老马',
      action: '导入公交数据',
      targetType: 'BusCardRecord',
      targetId: 'batch-002',
      detail: '导入 10 条公交刷卡时段记录'
    },
    {
      id: generateId(),
      timestamp: formatDateTime(new Date(Date.now() - 900000)),
      operator: '交通协管-老马',
      action: '确认冲突',
      targetType: 'ConflictRecord',
      targetId: 'conflict-001',
      detail: '确认「阳光花园」路口照片与公交数据冲突，照片属实'
    },
    {
      id: generateId(),
      timestamp: formatDateTime(),
      operator: '市政巡检员-李',
      action: '确认名称映射',
      targetType: 'CommunityNameMap',
      targetId: 'map-001',
      detail: '确认「幸福里」与「幸福里社区」为同一小区'
    }
  ];
}

export function generateAllMockData() {
  const photos = generateMockPhotos();
  const busRecords = generateMockBusRecords();
  const nameMaps = generateMockNameMaps();
  const logs = generateMockLogs();
  
  return { photos, busRecords, nameMaps, logs };
}

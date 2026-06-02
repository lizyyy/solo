import { ShelterPoint, ShelterStatus, ConflictType } from '../types';
import { generateCapacityAnalysis } from '../utils/nlGenerator';

export const mockShelters: ShelterPoint[] = [
  {
    id: 's1',
    standardName: '阳光社区活动中心',
    aliases: ['阳光活动中心', '社区活动中心'],
    longitude: 116.397128,
    latitude: 39.916527,
    designCapacity: 200,
    reportedCount: 150,
    status: ShelterStatus.PROCESSED,
    sourceIds: ['f1'],
    conflictType: ConflictType.NONE,
    capacityByTime: {
      morning: 150,
      noon: 80,
      afternoon: 60,
      evening: 40,
      night: 20
    },
    naturalLanguageResult: '',
    createdAt: '2026-06-01 09:00:00',
    updatedAt: '2026-06-01 10:00:00'
  },
  {
    id: 's2',
    standardName: '东门路口',
    aliases: ['东门口', '东门口交叉口', '东门十字', '东门红绿灯'],
    longitude: 116.398128,
    latitude: 39.917527,
    reportedLongitude: 116.398828,
    reportedLatitude: 39.918027,
    designCapacity: 300,
    reportedCount: 420,
    status: ShelterStatus.ONSITE_CHECK,
    sourceIds: ['f2', 'f3', 'f5'],
    conflictType: ConflictType.MIXED,
    capacityByTime: {
      morning: 100,
      noon: 150,
      afternoon: 200,
      evening: 420,
      night: 80
    },
    naturalLanguageResult: '',
    createdAt: '2026-06-01 22:00:00',
    updatedAt: '2026-06-02 10:00:00'
  },
  {
    id: 's3',
    standardName: '星光小学操场',
    aliases: ['星光小学', '星光学校操场', '小学操场'],
    longitude: 116.396128,
    latitude: 39.915527,
    designCapacity: 350,
    reportedCount: 400,
    status: ShelterStatus.PENDING_VERIFY,
    sourceIds: ['f4'],
    conflictType: ConflictType.CAPACITY,
    capacityByTime: {
      morning: 100,
      noon: 200,
      afternoon: 400,
      evening: 350,
      night: 150
    },
    naturalLanguageResult: '',
    oldDesignCapacity: 500,
    oldCapacityYear: '2020年旧口径',
    newDesignCapacity: 350,
    newCapacityYear: '2024年翻新后',
    createdAt: '2026-06-01 20:00:00',
    updatedAt: '2026-06-01 21:00:00'
  },
  {
    id: 's4',
    standardName: '中心广场',
    aliases: ['社区广场', '小区广场', '中央广场'],
    longitude: 116.395128,
    latitude: 39.914527,
    designCapacity: 200,
    reportedCount: 120,
    status: ShelterStatus.PROCESSED,
    sourceIds: ['f6'],
    conflictType: ConflictType.NONE,
    capacityByTime: {
      morning: 60,
      noon: 120,
      afternoon: 80,
      evening: 50,
      night: 30
    },
    naturalLanguageResult: '',
    createdAt: '2026-06-02 12:00:00',
    updatedAt: '2026-06-02 13:00:00'
  },
  {
    id: 's5',
    standardName: '第二中学体育馆',
    aliases: ['二中体育馆', '第二中学', '中学体育馆'],
    longitude: 116.394128,
    latitude: 39.913527,
    designCapacity: 300,
    reportedCount: 250,
    status: ShelterStatus.PROCESSED,
    sourceIds: ['f7'],
    conflictType: ConflictType.NONE,
    capacityByTime: {
      morning: 250,
      noon: 100,
      afternoon: 150,
      evening: 80,
      night: 40
    },
    naturalLanguageResult: '',
    createdAt: '2026-06-02 10:00:00',
    updatedAt: '2026-06-02 10:30:00'
  }
];

export const mockSheltersWithAnalysis: ShelterPoint[] = mockShelters.map(shelter => ({
  ...shelter,
  naturalLanguageResult: generateCapacityAnalysis(shelter)
}));

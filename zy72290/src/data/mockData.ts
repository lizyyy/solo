import type { PointRecord, OriginSpec, HistoryLog } from '@/types';

export const mockPointRecords: PointRecord[] = [
  {
    id: 'rec-001',
    pointCode: 'HD-A01',
    safetyRadius: 120.5,
    photoPointCount: 6,
    coordinateRowCount: 6,
    status: 'normal',
    scenarioType: 'smooth',
    recordStatus: 'completed',
    createdAt: '2024-06-03 09:15:00',
    coordinates: [
      { id: 'ce-001-1', recordId: 'rec-001', rowIndex: 1, x: 120.3, y: 45.6, radius: 120.5, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-001-2', recordId: 'rec-001', rowIndex: 2, x: 121.0, y: 46.2, radius: 120.5, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-001-3', recordId: 'rec-001', rowIndex: 3, x: 119.8, y: 45.9, radius: 120.5, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-001-4', recordId: 'rec-001', rowIndex: 4, x: 122.1, y: 44.8, radius: 120.5, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-001-5', recordId: 'rec-001', rowIndex: 5, x: 120.7, y: 46.5, radius: 120.5, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-001-6', recordId: 'rec-001', rowIndex: 6, x: 119.5, y: 45.3, radius: 120.5, isMissing: false, isSupplemented: false, supplementSource: '' },
    ],
  },
  {
    id: 'rec-002',
    pointCode: 'HD-B03',
    safetyRadius: 95.0,
    photoPointCount: 6,
    coordinateRowCount: 5,
    status: 'pending_review',
    scenarioType: 'missing_row',
    recordStatus: 'reviewing',
    createdAt: '2024-06-03 10:30:00',
    coordinates: [
      { id: 'ce-002-1', recordId: 'rec-002', rowIndex: 1, x: 85.2, y: 32.1, radius: 95.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-002-2', recordId: 'rec-002', rowIndex: 2, x: 86.0, y: 33.5, radius: 95.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-002-3', recordId: 'rec-002', rowIndex: 3, x: 84.7, y: 31.8, radius: 95.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-002-5', recordId: 'rec-002', rowIndex: 5, x: 87.3, y: 34.2, radius: 95.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-002-6', recordId: 'rec-002', rowIndex: 6, x: 85.9, y: 32.7, radius: 95.0, isMissing: false, isSupplemented: false, supplementSource: '' },
    ],
  },
  {
    id: 'rec-003',
    pointCode: 'HD-C07',
    safetyRadius: 110.0,
    photoPointCount: 6,
    coordinateRowCount: 6,
    status: 'supplemented',
    scenarioType: 'old_calibration',
    recordStatus: 'completed',
    createdAt: '2024-06-02 14:20:00',
    coordinates: [
      { id: 'ce-003-1', recordId: 'rec-003', rowIndex: 1, x: 105.1, y: 50.3, radius: 110.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-003-2', recordId: 'rec-003', rowIndex: 2, x: 106.4, y: 51.1, radius: 110.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-003-3', recordId: 'rec-003', rowIndex: 3, x: 104.8, y: 50.7, radius: 110.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-003-4s', recordId: 'rec-003', rowIndex: 4, x: 106.8, y: 50.2, radius: 110.0, isMissing: false, isSupplemented: true, supplementSource: '坐标原点说明-2023基准' },
      { id: 'ce-003-5', recordId: 'rec-003', rowIndex: 5, x: 107.2, y: 49.9, radius: 110.0, isMissing: false, isSupplemented: false, supplementSource: '' },
      { id: 'ce-003-6', recordId: 'rec-003', rowIndex: 6, x: 105.6, y: 51.5, radius: 110.0, isMissing: false, isSupplemented: false, supplementSource: '' },
    ],
  },
];

export const mockOriginSpecs: OriginSpec[] = [
  {
    id: 'os-001',
    originCode: 'HD-ORIGIN',
    originX: 100.0,
    originY: 50.0,
    referenceSystem: 'CGCS2000',
    measureDate: '2023-06-15',
    note: '海岛风暴潮淹没沙盘主原点',
  },
  {
    id: 'os-002',
    originCode: 'HD-OLD',
    originX: 99.8,
    originY: 49.7,
    referenceSystem: 'CGCS2000-2023',
    measureDate: '2023-03-20',
    note: '旧测量基准，用于补录旧口径坐标。当照片有点位但坐标表缺一行时，可参考此基准补录数据。',
  },
];

export const mockHistoryLogs: HistoryLog[] = [
  { id: 'log-001-1', recordId: 'rec-001', action: '导入安全半径表', operator: '阿景', timestamp: '2024-06-03 09:15:00', detail: '点位 HD-A01 安全半径表导入成功，共 6 行数据' },
  { id: 'log-001-2', recordId: 'rec-001', action: '数据完整性检测', operator: '系统', timestamp: '2024-06-03 09:15:05', detail: '照片 6 个点位，坐标表 6 行，数据完整' },
  { id: 'log-001-3', recordId: 'rec-001', action: '查看坐标原点说明', operator: '阿景', timestamp: '2024-06-03 09:16:00', detail: '确认坐标原点为 HD-ORIGIN' },
  { id: 'log-001-4', recordId: 'rec-001', action: '更新遮挡点清单', operator: '系统', timestamp: '2024-06-03 09:16:30', detail: '遮挡点计算完成，结果：正常通过' },

  { id: 'log-002-1', recordId: 'rec-002', action: '导入安全半径表', operator: '阿景', timestamp: '2024-06-03 10:30:00', detail: '点位 HD-B03 安全半径表导入成功，共 5 行数据' },
  { id: 'log-002-2', recordId: 'rec-002', action: '数据完整性检测', operator: '系统', timestamp: '2024-06-03 10:30:05', detail: '照片 6 个点位，坐标表 5 行，发现缺失第 4 行' },
  { id: 'log-002-3', recordId: 'rec-002', action: '标记待复核', operator: '系统', timestamp: '2024-06-03 10:30:06', detail: '照片有点位但坐标表缺一行，标记为待安全员复核，不归正常' },
  { id: 'log-002-4', recordId: 'rec-002', action: '查看坐标原点说明', operator: '阿景', timestamp: '2024-06-03 10:31:00', detail: '查看坐标原点说明，未找到可补录的旧口径数据' },
  { id: 'log-002-5', recordId: 'rec-002', action: '安全员复核中', operator: '系统', timestamp: '2024-06-03 10:32:00', detail: '提交安全复核流程，等待安全员确认' },

  { id: 'log-003-1', recordId: 'rec-003', action: '导入安全半径表', operator: '阿景', timestamp: '2024-06-02 14:20:00', detail: '点位 HD-C07 安全半径表导入成功，共 5 行数据' },
  { id: 'log-003-2', recordId: 'rec-003', action: '数据完整性检测', operator: '系统', timestamp: '2024-06-02 14:20:05', detail: '照片 6 个点位，坐标表 5 行，发现缺失第 4 行' },
  { id: 'log-003-3', recordId: 'rec-003', action: '标记待复核', operator: '系统', timestamp: '2024-06-02 14:20:06', detail: '照片有点位但坐标表缺一行，标记为待安全员复核' },
  { id: 'log-003-4', recordId: 'rec-003', action: '查看坐标原点说明', operator: '阿景', timestamp: '2024-06-02 14:25:00', detail: '从坐标原点说明中找到旧口径基准 HD-OLD' },
  { id: 'log-003-5', recordId: 'rec-003', action: '补录旧口径数据', operator: '阿景', timestamp: '2024-06-02 14:28:00', detail: '参考 2023 基准补录第 4 行坐标，来源：坐标原点说明-2023基准' },
  { id: 'log-003-6', recordId: 'rec-003', action: '安全员复核通过', operator: '安全员', timestamp: '2024-06-02 14:35:00', detail: '复核通过，补录数据有效' },
  { id: 'log-003-7', recordId: 'rec-003', action: '更新遮挡点清单', operator: '系统', timestamp: '2024-06-02 14:35:30', detail: '遮挡点计算完成，结果：已补录' },
];

import { Crack, Sensor, StressPoint, HistoryRecord } from '../types';

const now = new Date().toISOString();
const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export const mockCracks: Crack[] = [
  {
    id: 'crack-001',
    name: '上游坝面裂缝-01',
    coordinates: [
      [-8, 12, 25],
      [-6, 14, 25],
      [-4, 13, 25],
      [-2, 15, 25],
    ],
    length: 6.8,
    width: 2.1,
    depth: 0.45,
    severity: 'critical',
    status: 'active',
    photos: [
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=crack%20in%20concrete%20dam%20wall%20close%20up%20inspection&image_size=square',
    ],
    historyRecords: [],
    hasBoundaryIssue: false,
    createdAt: '2024-01-15T08:30:00Z',
    updatedAt: '2024-03-10T14:20:00Z',
  },
  {
    id: 'crack-002',
    name: '下游坝面裂缝-02',
    coordinates: [
      [5, 8, -20],
      [7, 10, -20],
      [9, 9, -20],
    ],
    length: 4.2,
    width: 1.2,
    depth: 0.28,
    severity: 'warning',
    status: 'monitored',
    photos: [],
    historyRecords: [],
    hasBoundaryIssue: false,
    createdAt: '2024-02-01T10:15:00Z',
    updatedAt: '2024-03-05T09:45:00Z',
  },
  {
    id: 'crack-003',
    name: '坝顶裂缝-03',
    coordinates: [
      [-15, 28, 0],
      [-12, 28, 0],
      [-9, 28, 0],
    ],
    length: 6.0,
    width: 0.8,
    depth: 0.15,
    severity: 'normal',
    status: 'monitored',
    photos: [],
    historyRecords: [],
    hasBoundaryIssue: false,
    createdAt: '2024-02-15T13:00:00Z',
    updatedAt: '2024-03-01T11:30:00Z',
  },
  {
    id: 'crack-004',
    name: '廊道裂缝-04 (坐标系偏移)',
    coordinates: [
      [100, 100, 100],
      [102, 102, 100],
    ],
    length: 2.5,
    width: 1.5,
    depth: 0.3,
    severity: 'warning',
    status: 'active',
    photos: [],
    historyRecords: [
      {
        id: 'hist-001',
        targetType: 'crack',
        targetId: 'crack-004',
        changeType: 'coordinate_correction',
        beforeValue: '坐标: [100,100,100]',
        afterValue: '坐标: [3,5,-10] (待确认)',
        reason: 'GPS信号漂移导致坐标异常',
        operator: '系统自动检测',
        manualConfirmed: false,
        createdAt: '2024-03-08T16:00:00Z',
      },
    ],
    hasBoundaryIssue: true,
    boundaryType: 'coordinate_offset',
    createdAt: '2024-03-05T09:00:00Z',
    updatedAt: '2024-03-08T16:00:00Z',
  },
  {
    id: 'crack-005',
    name: '上游坝面裂缝-05 (重复记录)',
    coordinates: [
      [-8, 12, 25],
      [-6, 14, 25],
      [-4, 13, 25],
    ],
    length: 6.7,
    width: 2.0,
    depth: 0.44,
    severity: 'critical',
    status: 'active',
    photos: [],
    historyRecords: [
      {
        id: 'hist-002',
        targetType: 'crack',
        targetId: 'crack-005',
        changeType: 'duplicate_merge',
        beforeValue: '独立裂缝记录',
        afterValue: '疑似与crack-001重复',
        reason: '两次巡检数据重复录入',
        operator: '张工',
        manualConfirmed: true,
        createdAt: '2024-03-12T10:30:00Z',
      },
    ],
    hasBoundaryIssue: true,
    boundaryType: 'duplicate',
    manualConfirmed: {
      operator: '张工',
      timestamp: '2024-03-12T10:30:00Z',
      notes: '已确认为重复记录，保留crack-001作为主记录',
    },
    createdAt: '2024-01-16T08:30:00Z',
    updatedAt: '2024-03-12T10:30:00Z',
  },
  {
    id: 'crack-006',
    name: '已修复裂缝-06',
    coordinates: [
      [0, 20, 15],
      [2, 22, 15],
      [4, 21, 15],
    ],
    length: 4.0,
    width: 0.5,
    depth: 0.1,
    severity: 'normal',
    status: 'repaired',
    photos: [],
    historyRecords: [
      {
        id: 'hist-003',
        targetType: 'crack',
        targetId: 'crack-006',
        changeType: 'status_update',
        beforeValue: 'active',
        afterValue: 'repaired',
        reason: '环氧树脂灌浆修复完成',
        operator: '李工',
        manualConfirmed: true,
        createdAt: '2024-02-28T15:00:00Z',
      },
    ],
    hasBoundaryIssue: false,
    manualConfirmed: {
      operator: '李工',
      timestamp: '2024-02-28T15:00:00Z',
      notes: '修复验收合格',
    },
    createdAt: '2023-12-01T00:00:00Z',
    updatedAt: '2024-02-28T15:00:00Z',
  },
];

export const mockSensors: Sensor[] = [
  {
    id: 'sensor-001',
    name: '渗压计-P01',
    type: 'seepage',
    position: [-5, 3, 10],
    currentValue: 0.12,
    threshold: 0.3,
    unit: 'MPa',
    status: 'normal',
    timeSeriesData: generateTimeSeriesData(0.1, 0.15, 30),
    hasBreakpoint: false,
    breakpointRecords: [],
    lastReading: now,
  },
  {
    id: 'sensor-002',
    name: '渗压计-P02',
    type: 'seepage',
    position: [5, 3, -10],
    currentValue: 0.28,
    threshold: 0.3,
    unit: 'MPa',
    status: 'warning',
    timeSeriesData: generateTimeSeriesData(0.2, 0.3, 30),
    hasBreakpoint: false,
    breakpointRecords: [],
    lastReading: now,
  },
  {
    id: 'sensor-003',
    name: '应力计-S01',
    type: 'stress',
    position: [0, 15, 0],
    currentValue: 2.1,
    threshold: 3.0,
    unit: 'MPa',
    status: 'normal',
    timeSeriesData: generateTimeSeriesData(1.8, 2.3, 30),
    hasBreakpoint: false,
    breakpointRecords: [],
    lastReading: now,
  },
  {
    id: 'sensor-004',
    name: '应力计-S02',
    type: 'stress',
    position: [-10, 20, 10],
    currentValue: 3.5,
    threshold: 3.0,
    unit: 'MPa',
    status: 'alarm',
    timeSeriesData: generateTimeSeriesData(2.8, 3.6, 30),
    hasBreakpoint: false,
    breakpointRecords: [],
    lastReading: now,
  },
  {
    id: 'sensor-005',
    name: '位移计-D01',
    type: 'displacement',
    position: [10, 25, 0],
    currentValue: 15.2,
    threshold: 20.0,
    unit: 'mm',
    status: 'normal',
    timeSeriesData: generateTimeSeriesData(12, 16, 30),
    hasBreakpoint: false,
    breakpointRecords: [],
    lastReading: now,
  },
  {
    id: 'sensor-006',
    name: '渗压计-P03 (数据断点)',
    type: 'seepage',
    position: [0, 5, -15],
    currentValue: 0.22,
    threshold: 0.3,
    unit: 'MPa',
    status: 'warning',
    timeSeriesData: [
      ...generateTimeSeriesData(0.18, 0.22, 15),
      ...generateTimeSeriesData(0.2, 0.24, 10, 20),
    ],
    hasBreakpoint: true,
    breakpointRecords: [
      {
        startTime: '2024-03-01T00:00:00Z',
        endTime: '2024-03-05T23:59:59Z',
        reason: '传感器通信故障，5天无数据',
      },
    ],
    manualConfirmed: {
      operator: '王工',
      timestamp: '2024-03-06T09:00:00Z',
      notes: '已更换通信模块，数据恢复正常',
    },
    lastReading: now,
  },
  {
    id: 'sensor-007',
    name: '渗压计-P04 (离线)',
    type: 'seepage',
    position: [-15, 8, 5],
    currentValue: 0,
    threshold: 0.3,
    unit: 'MPa',
    status: 'offline',
    timeSeriesData: generateTimeSeriesData(0.15, 0.2, 25),
    hasBreakpoint: true,
    breakpointRecords: [
      {
        startTime: '2024-03-20T00:00:00Z',
        endTime: null,
        reason: '传感器电源故障，待维修',
      },
    ],
    lastReading: '2024-03-19T23:59:59Z',
  },
];

export const mockStressPoints: StressPoint[] = [];

for (let i = 0; i < 50; i++) {
  const x = (Math.random() - 0.5) * 30;
  const y = Math.random() * 25 + 3;
  const z = (Math.random() - 0.5) * 40;
  const stressValue = Math.random() * 4 + 0.5;
  let level: 'low' | 'medium' | 'high' | 'critical';
  if (stressValue < 1.5) level = 'low';
  else if (stressValue < 2.5) level = 'medium';
  else if (stressValue < 3.5) level = 'high';
  else level = 'critical';

  mockStressPoints.push({
    id: `stress-${String(i + 1).padStart(3, '0')}`,
    position: [x, y, z],
    stressValue,
    strainValue: stressValue * 0.0001,
    direction: ['x', 'y', 'z'][Math.floor(Math.random() * 3)] as 'x' | 'y' | 'z',
    level,
    measuredAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

export const mockHistoryRecords: HistoryRecord[] = [
  {
    id: 'hist-001',
    targetType: 'crack',
    targetId: 'crack-004',
    changeType: 'coordinate_correction',
    beforeValue: '坐标: [100,100,100]',
    afterValue: '坐标: [3,5,-10] (待确认)',
    reason: 'GPS信号漂移导致坐标异常',
    operator: '系统自动检测',
    manualConfirmed: false,
    createdAt: '2024-03-08T16:00:00Z',
  },
  {
    id: 'hist-002',
    targetType: 'crack',
    targetId: 'crack-005',
    changeType: 'duplicate_merge',
    beforeValue: '独立裂缝记录',
    afterValue: '疑似与crack-001重复',
    reason: '两次巡检数据重复录入',
    operator: '张工',
    manualConfirmed: true,
    createdAt: '2024-03-12T10:30:00Z',
  },
  {
    id: 'hist-003',
    targetType: 'crack',
    targetId: 'crack-006',
    changeType: 'status_update',
    beforeValue: 'active',
    afterValue: 'repaired',
    reason: '环氧树脂灌浆修复完成',
    operator: '李工',
    manualConfirmed: true,
    createdAt: '2024-02-28T15:00:00Z',
  },
  {
    id: 'hist-004',
    targetType: 'sensor',
    targetId: 'sensor-006',
    changeType: 'breakpoint_fix',
    beforeValue: '通信中断(2024-03-01至2024-03-05)',
    afterValue: '数据恢复正常',
    reason: '更换通信模块',
    operator: '王工',
    manualConfirmed: true,
    createdAt: '2024-03-06T09:00:00Z',
  },
  {
    id: 'hist-005',
    targetType: 'sensor',
    targetId: 'sensor-007',
    changeType: 'breakpoint_fix',
    beforeValue: '正常运行',
    afterValue: '离线待修',
    reason: '电源故障',
    operator: '系统自动检测',
    manualConfirmed: false,
    createdAt: '2024-03-20T00:00:00Z',
  },
  {
    id: 'hist-006',
    targetType: 'crack',
    targetId: 'crack-001',
    changeType: 'manual_confirm',
    beforeValue: '未确认',
    afterValue: '关键裂缝，持续监测',
    reason: '季度巡检人工确认',
    operator: '张工',
    manualConfirmed: true,
    createdAt: '2024-03-10T14:20:00Z',
  },
];

function generateTimeSeriesData(
  min: number,
  max: number,
  count: number,
  startDayOffset: number = 0
): { timestamp: string; value: number }[] {
  const data: { timestamp: string; value: number }[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.now() - (startDayOffset + count - 1 - i) * 24 * 60 * 60 * 1000);
    data.push({
      timestamp: date.toISOString(),
      value: min + Math.random() * (max - min),
    });
  }
  return data;
}

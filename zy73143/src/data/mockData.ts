import type { BuoyLog, SpatialMark, Anomaly, ChangeLog } from '../types';

const now = new Date();
const dayMs = 24 * 60 * 60 * 1000;

const STABLE_RECORD_TIMES: Record<string, string> = {
  'FB-A01': '2026-06-15T14:00:00.000Z',
  'FB-A02': '2026-06-16T10:30:00.000Z',
  'FB-B01': '2026-06-17T09:15:00.000Z',
  'FB-A03': '2026-06-13T15:45:00.000Z',
  'FB-C01': '2026-06-14T13:20:00.000Z',
};

const STABLE_CREATED_TIMES: Record<string, string> = {
  'FB-A01': '2026-06-15T14:05:00.000Z',
  'FB-A02': '2026-06-16T10:35:00.000Z',
  'FB-B01': '2026-06-17T09:20:00.000Z',
  'FB-A03': '2026-06-13T15:50:00.000Z',
  'FB-C01': '2026-06-14T13:25:00.000Z',
};

export const mockBuoyLogs: BuoyLog[] = [
  {
    id: 'log-001',
    buoyId: 'FB-A01',
    longitude: 118.7823,
    latitude: 32.0456,
    temperature: 22.5,
    seagrassCoverage: 78,
    biomass: 156,
    recordTime: STABLE_RECORD_TIMES['FB-A01'],
    importBatch: 'batch-2024-0615-01',
    remark: '首次调查，海草生长良好',
    isConfirmed: true,
    confirmedAt: '2026-06-16T09:00:00.000Z',
    confirmer: '老何',
    createdAt: STABLE_CREATED_TIMES['FB-A01'],
    updatedAt: '2026-06-16T09:00:00.000Z',
  },
  {
    id: 'log-002',
    buoyId: 'FB-A02',
    longitude: 118.7956,
    latitude: 32.0589,
    temperature: 23.1,
    seagrassCoverage: 65,
    biomass: 128,
    recordTime: STABLE_RECORD_TIMES['FB-A02'],
    importBatch: 'batch-2024-0616-01',
    remark: '',
    isConfirmed: false,
    createdAt: STABLE_CREATED_TIMES['FB-A02'],
    updatedAt: STABLE_CREATED_TIMES['FB-A02'],
  },
  {
    id: 'log-003',
    buoyId: 'FB-B01',
    longitude: 32.0712,
    latitude: 118.8034,
    temperature: 21.8,
    seagrassCoverage: 45,
    biomass: 92,
    recordTime: STABLE_RECORD_TIMES['FB-B01'],
    importBatch: 'batch-2024-0617-01',
    remark: '',
    isConfirmed: false,
    createdAt: STABLE_CREATED_TIMES['FB-B01'],
    updatedAt: STABLE_CREATED_TIMES['FB-B01'],
  },
  {
    id: 'log-004',
    buoyId: 'FB-A03',
    longitude: 118.7689,
    latitude: 32.0321,
    temperature: 24.2,
    seagrassCoverage: 82,
    biomass: 175,
    recordTime: STABLE_RECORD_TIMES['FB-A03'],
    importBatch: 'batch-2024-0613-01',
    remark: '高密度海草区，生物量超预期',
    isConfirmed: true,
    confirmedAt: '2026-06-14T10:00:00.000Z',
    confirmer: '老何',
    createdAt: STABLE_CREATED_TIMES['FB-A03'],
    updatedAt: '2026-06-14T10:00:00.000Z',
  },
  {
    id: 'log-005',
    buoyId: 'FB-C01',
    longitude: 118.8123,
    latitude: 32.0856,
    temperature: 20.5,
    seagrassCoverage: 30,
    biomass: 58,
    recordTime: STABLE_RECORD_TIMES['FB-C01'],
    importBatch: 'batch-2024-0614-01',
    remark: '近岸区域，覆盖度较低',
    isConfirmed: true,
    confirmedAt: '2026-06-15T11:00:00.000Z',
    confirmer: '老何',
    createdAt: STABLE_CREATED_TIMES['FB-C01'],
    updatedAt: '2026-06-15T11:00:00.000Z',
  },
];

export const mockSpatialMarks: SpatialMark[] = [
  {
    id: 'mark-001',
    name: 'A区核心海草床',
    longitude: 118.78,
    latitude: 32.05,
    type: 'core_zone',
    calculationMethod: '采用样方法调查，每100米设一个样方，取平均值计算覆盖度和生物量',
    buoyLogIds: ['log-001', 'log-004'],
    status: 'normal',
    remark: '保护等级：一级',
    createdAt: STABLE_CREATED_TIMES['FB-A01'],
    updatedAt: '2026-06-16T09:00:00.000Z',
  },
  {
    id: 'mark-002',
    name: 'B区过渡带',
    longitude: 118.80,
    latitude: 32.07,
    type: 'transition_zone',
    calculationMethod: '采用断面法，沿水深梯度布设3条断面，每条断面设5个观测点',
    buoyLogIds: ['log-003'],
    status: 'abnormal',
    remark: '经纬度疑似反写，需核实',
    createdAt: STABLE_CREATED_TIMES['FB-B01'],
    updatedAt: STABLE_CREATED_TIMES['FB-B01'],
  },
  {
    id: 'mark-003',
    name: 'C区近岸带',
    longitude: 118.81,
    latitude: 32.09,
    type: 'nearshore_zone',
    calculationMethod: '采用遥感影像解译结合现场验证的方法',
    buoyLogIds: ['log-005'],
    status: 'normal',
    remark: '受人类活动影响较大',
    createdAt: STABLE_CREATED_TIMES['FB-C01'],
    updatedAt: '2026-06-15T11:00:00.000Z',
  },
];

export const mockAnomalies: Anomaly[] = [
  {
    id: 'anomaly-001',
    sourceType: 'buoy_log',
    sourceId: 'log-003',
    type: 'latlng_swapped',
    description: '经纬度数值疑似反写：经度32.07不在正常范围(73-135)，纬度118.80超出正常范围(-90~90)',
    severity: 'high',
    isResolved: false,
    detectedAt: STABLE_CREATED_TIMES['FB-B01'],
  },
  {
    id: 'anomaly-002',
    sourceType: 'buoy_log',
    sourceId: 'log-004',
    type: 'value_outlier',
    description: '生物量数值偏高（175g/m²），超出历史均值2倍标准差',
    severity: 'medium',
    isResolved: true,
    resolvedRemark: '经核实为高密度海草区，数据有效',
    resolvedBy: '老何',
    detectedAt: STABLE_CREATED_TIMES['FB-A03'],
    resolvedAt: '2026-06-14T10:00:00.000Z',
  },
];

export const mockChangeLogs: ChangeLog[] = [
  {
    id: 'change-001',
    sourceType: 'buoy_log',
    sourceId: 'log-001',
    action: 'import',
    beforeData: null,
    afterData: {
      buoyId: 'FB-A01',
      seagrassCoverage: 78,
      biomass: 156,
    },
    operator: '系统',
    remark: '导入批次 batch-2024-0615-01',
    createdAt: STABLE_CREATED_TIMES['FB-A01'],
  },
  {
    id: 'change-002',
    sourceType: 'buoy_log',
    sourceId: 'log-001',
    action: 'confirm',
    beforeData: {
      isConfirmed: false,
      remark: '',
    },
    afterData: {
      isConfirmed: true,
      remark: '首次调查，海草生长良好',
      confirmer: '老何',
    },
    operator: '老何',
    remark: '人工确认数据有效',
    createdAt: '2026-06-16T09:00:00.000Z',
  },
  {
    id: 'change-003',
    sourceType: 'anomaly',
    sourceId: 'anomaly-002',
    action: 'resolve',
    beforeData: {
      isResolved: false,
    },
    afterData: {
      isResolved: true,
      resolvedRemark: '经核实为高密度海草区，数据有效',
      resolvedBy: '老何',
    },
    operator: '老何',
    remark: '异常核实后处理',
    createdAt: '2026-06-14T10:00:00.000Z',
  },
  {
    id: 'change-004',
    sourceType: 'spatial_mark',
    sourceId: 'mark-002',
    action: 'create',
    beforeData: null,
    afterData: {
      name: 'B区过渡带',
      status: 'abnormal',
      remark: '经纬度疑似反写，需核实',
    },
    operator: '系统',
    remark: '根据浮标日志自动创建标注',
    createdAt: STABLE_CREATED_TIMES['FB-B01'],
  },
  {
    id: 'change-005',
    sourceType: 'buoy_log',
    sourceId: 'log-004',
    action: 'update',
    beforeData: {
      remark: '',
    },
    afterData: {
      remark: '高密度海草区，生物量超预期',
    },
    operator: '老何',
    remark: '补充人工备注',
    createdAt: STABLE_CREATED_TIMES['FB-A03'],
  },
];

export const getTrendData = () => {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * dayMs);
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      coverage: Math.round(60 + Math.random() * 20),
      biomass: Math.round(100 + Math.random() * 60),
      isAnomaly: i === 3,
      logId: i === 3 ? 'log-004' : null,
    });
  }
  return data;
};

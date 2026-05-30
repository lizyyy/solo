import type { Batch, SamplePoint, HistoryRecord, FitResult } from '@/types';
import dayjs from 'dayjs';

const generateId = () => Math.random().toString(36).substring(2, 11);

const generateBatchNo = (date: string, seq: number) => {
  const d = dayjs(date).format('YYYYMMDD');
  return `RC-${d}-${seq.toString().padStart(3, '0')}`;
};

const generateDischargeData = (
  V0: number,
  tau: number,
  numPoints: number,
  timeUnit: string,
  noiseLevel: number = 0.02
): SamplePoint[] => {
  const points: SamplePoint[] = [];
  const maxTime = 5 * tau;

  let timeMultiplier = 1;
  if (timeUnit === 'ms') timeMultiplier = 1000;
  if (timeUnit === 'μs') timeMultiplier = 1000000;

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * maxTime;
    const noise = (Math.random() - 0.5) * 2 * noiseLevel * V0;
    let V = V0 * Math.exp(-t / tau) + noise;
    V = Math.max(0, V);

    points.push({
      id: generateId(),
      batchId: '',
      time: parseFloat((t * timeMultiplier).toFixed(4)),
      voltage: parseFloat(V.toFixed(4)),
      isOutlier: false,
      outlierReason: null,
      residual: null,
      sequence: i + 1,
    });
  }

  return points;
};

const generateChargeData = (
  V0: number,
  Vs: number,
  tau: number,
  numPoints: number,
  timeUnit: string,
  noiseLevel: number = 0.02
): SamplePoint[] => {
  const points: SamplePoint[] = [];
  const maxTime = 5 * tau;

  let timeMultiplier = 1;
  if (timeUnit === 'ms') timeMultiplier = 1000;
  if (timeUnit === 'μs') timeMultiplier = 1000000;

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * maxTime;
    const noise = (Math.random() - 0.5) * 2 * noiseLevel * Vs;
    let V = Vs + (V0 - Vs) * Math.exp(-t / tau) + noise;
    V = Math.max(0, V);

    points.push({
      id: generateId(),
      batchId: '',
      time: parseFloat((t * timeMultiplier).toFixed(4)),
      voltage: parseFloat(V.toFixed(4)),
      isOutlier: false,
      outlierReason: null,
      residual: null,
      sequence: i + 1,
    });
  }

  return points;
};

export const mockBatches: Batch[] = [
  {
    id: 'batch-001',
    batchNo: generateBatchNo('2024-05-28', 1),
    studentName: '张三',
    experimentDate: '2024-05-28',
    resistance: 10,
    resistanceUnit: 'kΩ',
    capacitance: 100,
    capacitanceUnit: 'μF',
    initialVoltage: 5.0,
    supplyVoltage: null,
    timeUnit: 's',
    status: 'analyzed',
    needsReanalysis: false,
    fitMode: 'discharge',
    createdAt: dayjs('2024-05-28 09:00:00').toISOString(),
    updatedAt: dayjs('2024-05-28 10:30:00').toISOString(),
    dataVersion: 3,
  },
  {
    id: 'batch-002',
    batchNo: generateBatchNo('2024-05-28', 2),
    studentName: '李四',
    experimentDate: '2024-05-28',
    resistance: 1,
    resistanceUnit: 'MΩ',
    capacitance: 1,
    capacitanceUnit: 'μF',
    initialVoltage: 12.0,
    supplyVoltage: null,
    timeUnit: 's',
    status: 'draft',
    needsReanalysis: true,
    fitMode: 'discharge',
    createdAt: dayjs('2024-05-28 11:00:00').toISOString(),
    updatedAt: dayjs('2024-05-28 11:15:00').toISOString(),
    dataVersion: 1,
  },
  {
    id: 'batch-003',
    batchNo: generateBatchNo('2024-05-29', 1),
    studentName: '王五',
    experimentDate: '2024-05-29',
    resistance: 100,
    resistanceUnit: 'Ω',
    capacitance: 1000,
    capacitanceUnit: 'μF',
    initialVoltage: 0.0,
    supplyVoltage: 5.0,
    timeUnit: 'ms',
    status: 'reported',
    needsReanalysis: false,
    fitMode: 'charge',
    createdAt: dayjs('2024-05-29 14:00:00').toISOString(),
    updatedAt: dayjs('2024-05-29 16:00:00').toISOString(),
    dataVersion: 5,
  },
  {
    id: 'batch-004',
    batchNo: generateBatchNo('2024-05-29', 2),
    studentName: '赵六',
    experimentDate: '2024-05-29',
    resistance: null,
    resistanceUnit: 'kΩ',
    capacitance: 47,
    capacitanceUnit: 'μF',
    initialVoltage: null,
    supplyVoltage: null,
    timeUnit: 's',
    status: 'draft',
    needsReanalysis: false,
    fitMode: 'discharge',
    createdAt: dayjs('2024-05-29 16:30:00').toISOString(),
    updatedAt: dayjs('2024-05-29 16:35:00').toISOString(),
    dataVersion: 1,
  },
  {
    id: 'batch-005',
    batchNo: generateBatchNo('2024-05-30', 1),
    studentName: '张三',
    experimentDate: '2024-05-30',
    resistance: 47,
    resistanceUnit: 'kΩ',
    capacitance: 22,
    capacitanceUnit: 'nF',
    initialVoltage: 3.3,
    supplyVoltage: null,
    timeUnit: 'μs',
    status: 'analyzed',
    needsReanalysis: false,
    fitMode: 'discharge',
    createdAt: dayjs('2024-05-30 08:30:00').toISOString(),
    updatedAt: dayjs('2024-05-30 09:45:00').toISOString(),
    dataVersion: 2,
  },
];

export const mockSamplePoints: Record<string, SamplePoint[]> = {
  'batch-001': generateDischargeData(5.0, 1.0, 20, 's', 0.015).map((p) => ({
    ...p,
    batchId: 'batch-001',
  })),
  'batch-002': generateDischargeData(12.0, 1.0, 15, 's', 0.03).map((p) => ({
    ...p,
    batchId: 'batch-002',
  })),
  'batch-003': generateChargeData(0.0, 5.0, 0.1, 25, 'ms', 0.02).map((p) => ({
    ...p,
    batchId: 'batch-003',
  })),
  'batch-004': [],
  'batch-005': generateDischargeData(3.3, 0.001034, 18, 'μs', 0.025).map(
    (p) => ({
      ...p,
      batchId: 'batch-005',
    })
  ),
};

export const mockHistoryRecords: Record<string, HistoryRecord[]> = {
  'batch-001': [
    {
      id: 'hist-001',
      batchId: 'batch-001',
      fieldName: 'resistance',
      oldValue: null,
      newValue: '10 kΩ',
      modifiedBy: '张三',
      changeType: 'manual',
      description: '录入电阻值 R=10kΩ',
      timestamp: dayjs('2024-05-28 09:05:00').toISOString(),
      version: 1,
    },
    {
      id: 'hist-002',
      batchId: 'batch-001',
      fieldName: 'capacitance',
      oldValue: null,
      newValue: '100 μF',
      modifiedBy: '张三',
      changeType: 'manual',
      description: '录入电容值 C=100μF',
      timestamp: dayjs('2024-05-28 09:10:00').toISOString(),
      version: 2,
    },
    {
      id: 'hist-003',
      batchId: 'batch-001',
      fieldName: 'samplePoints',
      oldValue: '0个采样点',
      newValue: '20个采样点',
      modifiedBy: '张三',
      changeType: 'manual',
      description: '导入20组放电采样数据',
      timestamp: dayjs('2024-05-28 09:30:00').toISOString(),
      version: 3,
    },
    {
      id: 'hist-004',
      batchId: 'batch-001',
      fieldName: 'fitResult',
      oldValue: null,
      newValue: 'τ=1.023s, R²=0.9987',
      modifiedBy: '系统',
      changeType: 'automatic',
      description: '完成指数拟合计算',
      timestamp: dayjs('2024-05-28 10:00:00').toISOString(),
      version: 3,
    },
    {
      id: 'hist-005',
      batchId: 'batch-001',
      fieldName: 'initialVoltage',
      oldValue: '5.0V',
      newValue: '5.02V',
      modifiedBy: '张三',
      changeType: 'manual',
      description: '修正初始电压值（校准后）',
      timestamp: dayjs('2024-05-28 10:20:00').toISOString(),
      version: 4,
    },
  ],
  'batch-002': [
    {
      id: 'hist-006',
      batchId: 'batch-002',
      fieldName: 'resistance',
      oldValue: null,
      newValue: '1 MΩ',
      modifiedBy: '李四',
      changeType: 'manual',
      description: '录入电阻值 R=1MΩ',
      timestamp: dayjs('2024-05-28 11:05:00').toISOString(),
      version: 1,
    },
    {
      id: 'hist-007',
      batchId: 'batch-002',
      fieldName: 'capacitance',
      oldValue: null,
      newValue: '1 μF',
      modifiedBy: '李四',
      changeType: 'manual',
      description: '录入电容值 C=1μF',
      timestamp: dayjs('2024-05-28 11:10:00').toISOString(),
      version: 1,
    },
  ],
  'batch-003': [
    {
      id: 'hist-008',
      batchId: 'batch-003',
      fieldName: 'resistance',
      oldValue: null,
      newValue: '100 Ω',
      modifiedBy: '王五',
      changeType: 'manual',
      description: '录入电阻值 R=100Ω',
      timestamp: dayjs('2024-05-29 14:05:00').toISOString(),
      version: 1,
    },
    {
      id: 'hist-009',
      batchId: 'batch-003',
      fieldName: 'capacitance',
      oldValue: null,
      newValue: '1000 μF',
      modifiedBy: '王五',
      changeType: 'manual',
      description: '录入电容值 C=1000μF',
      timestamp: dayjs('2024-05-29 14:10:00').toISOString(),
      version: 2,
    },
    {
      id: 'hist-010',
      batchId: 'batch-003',
      fieldName: 'samplePoints',
      oldValue: '0个采样点',
      newValue: '25个采样点',
      modifiedBy: '王五',
      changeType: 'manual',
      description: '导入25组充电采样数据',
      timestamp: dayjs('2024-05-29 14:30:00').toISOString(),
      version: 3,
    },
    {
      id: 'hist-011',
      batchId: 'batch-003',
      fieldName: 'fitResult',
      oldValue: null,
      newValue: 'τ=0.098s, R²=0.9992',
      modifiedBy: '系统',
      changeType: 'automatic',
      description: '完成指数拟合计算',
      timestamp: dayjs('2024-05-29 15:00:00').toISOString(),
      version: 4,
    },
    {
      id: 'hist-012',
      batchId: 'batch-003',
      fieldName: 'status',
      oldValue: 'analyzed',
      newValue: 'reported',
      modifiedBy: '王五',
      changeType: 'manual',
      description: '生成并导出实验报告',
      timestamp: dayjs('2024-05-29 16:00:00').toISOString(),
      version: 5,
    },
  ],
  'batch-004': [
    {
      id: 'hist-013',
      batchId: 'batch-004',
      fieldName: 'capacitance',
      oldValue: null,
      newValue: '47 μF',
      modifiedBy: '赵六',
      changeType: 'manual',
      description: '录入电容值 C=47μF（电阻待补）',
      timestamp: dayjs('2024-05-29 16:35:00').toISOString(),
      version: 1,
    },
  ],
  'batch-005': [
    {
      id: 'hist-014',
      batchId: 'batch-005',
      fieldName: 'resistance',
      oldValue: null,
      newValue: '47 kΩ',
      modifiedBy: '张三',
      changeType: 'manual',
      description: '录入电阻值 R=47kΩ',
      timestamp: dayjs('2024-05-30 08:35:00').toISOString(),
      version: 1,
    },
    {
      id: 'hist-015',
      batchId: 'batch-005',
      fieldName: 'capacitance',
      oldValue: null,
      newValue: '22 nF',
      modifiedBy: '张三',
      changeType: 'manual',
      description: '录入电容值 C=22nF',
      timestamp: dayjs('2024-05-30 08:40:00').toISOString(),
      version: 1,
    },
    {
      id: 'hist-016',
      batchId: 'batch-005',
      fieldName: 'samplePoints',
      oldValue: '0个采样点',
      newValue: '18个采样点',
      modifiedBy: '张三',
      changeType: 'manual',
      description: '导入18组放电采样数据',
      timestamp: dayjs('2024-05-30 09:00:00').toISOString(),
      version: 2,
    },
  ],
};

export const mockFitResults: Record<string, FitResult> = {
  'batch-001': {
    id: 'fit-001',
    batchId: 'batch-001',
    tau: 1.0234,
    tauStdErr: 0.0087,
    rSquared: 0.9987,
    adjustedRSquared: 0.9986,
    rootMeanSquaredError: 0.0523,
    fittedParams: {
      V0: 5.02,
      Vs: 0,
      tau: 1.0234,
    },
    confidenceInterval: {
      lower: [],
      upper: [],
    },
    algorithm: 'Levenberg-Marquardt (42 iterations)',
    computedAt: dayjs('2024-05-28 10:00:00').toISOString(),
    dataVersion: 3,
  },
  'batch-003': {
    id: 'fit-003',
    batchId: 'batch-003',
    tau: 0.0987,
    tauStdErr: 0.0012,
    rSquared: 0.9992,
    adjustedRSquared: 0.9991,
    rootMeanSquaredError: 0.0345,
    fittedParams: {
      V0: 0.012,
      Vs: 4.98,
      tau: 0.0987,
    },
    confidenceInterval: {
      lower: [],
      upper: [],
    },
    algorithm: 'Levenberg-Marquardt (38 iterations)',
    computedAt: dayjs('2024-05-29 15:00:00').toISOString(),
    dataVersion: 4,
  },
  'batch-005': {
    id: 'fit-005',
    batchId: 'batch-005',
    tau: 0.001034,
    tauStdErr: 0.000012,
    rSquared: 0.9978,
    adjustedRSquared: 0.9977,
    rootMeanSquaredError: 0.0412,
    fittedParams: {
      V0: 3.31,
      Vs: 0,
      tau: 0.001034,
    },
    confidenceInterval: {
      lower: [],
      upper: [],
    },
    algorithm: 'Levenberg-Marquardt (56 iterations)',
    computedAt: dayjs('2024-05-30 09:30:00').toISOString(),
    dataVersion: 2,
  },
};

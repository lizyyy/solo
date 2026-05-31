import { Warning, Threshold, VibrationData, OperationLog, WarningDetail, FilterOptions } from '../types';
import { generateFaultJudgment, generatePlainReason, generateNextSteps } from '../utils/judgmentReason';

const deviceNames = ['1#冷库压缩机', '2#冷库压缩机', '3#冷库蒸发器', '4#冷库冷凝器', '5#冷库循环泵', '6#冷库风机组'];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function randomDate(base: Date, offsetMinutes: number): string {
  return new Date(base.getTime() + offsetMinutes * 60 * 1000).toISOString();
}

export function generateMockWarnings(): Warning[] {
  const now = new Date();
  const warnings: Warning[] = [];

  for (let i = 0; i < 8; i++) {
    const statusRoll = Math.random();
    let status: Warning['status'];
    if (statusRoll < 0.3) status = 'fault';
    else if (statusRoll < 0.6) status = 'warning';
    else status = 'normal';

    warnings.push({
      id: generateId('warn'),
      deviceId: `DEV-${String(i + 1).padStart(3, '0')}`,
      deviceName: deviceNames[i % deviceNames.length],
      status,
      temperature: Math.round((-18 + Math.random() * 10) * 10) / 10,
      vibration: Math.round((2 + Math.random() * 9) * 100) / 100,
      createdAt: randomDate(now, -i * 120 - Math.random() * 60),
      updatedAt: randomDate(now, -i * 30),
    });
  }

  return warnings;
}

export function generateMockThresholds(warningId: string, warningCreatedAt: string): Threshold[] {
  const baseTime = new Date(warningCreatedAt);
  const metrics = [
    { name: '振动速度', min: 0, max: 8.0, actual: 0, backfilled: false },
    { name: '温度偏差', min: -2, max: 2, actual: 0, backfilled: false },
    { name: '电流值', min: 10, max: 35, actual: 0, backfilled: true },
    { name: '油压', min: 0.2, max: 0.5, actual: 0, backfilled: false },
    { name: '排气温度', min: 50, max: 90, actual: 0, backfilled: true },
  ];

  return metrics.map((m, i) => {
    const actualValue = m.min + Math.random() * (m.max - m.min) * 1.3;
    const submittedOffset = m.backfilled ? -180 - Math.random() * 60 : -60 + i * 10;
    
    return {
      id: generateId('thres'),
      warningId,
      metric: m.name,
      minValue: m.min,
      maxValue: m.max,
      actualValue: Math.round(actualValue * 100) / 100,
      isBackfilled: m.backfilled,
      submittedAt: randomDate(baseTime, submittedOffset),
      expectedAt: randomDate(baseTime, -30),
    };
  });
}

export function generateMockVibrationData(warningId: string, warningCreatedAt: string): VibrationData[] {
  const baseTime = new Date(warningCreatedAt);
  const data: VibrationData[] = [];
  const pointCount = 48;

  for (let i = 0; i < pointCount; i++) {
    const baseValue = 3 + Math.sin(i / 6) * 2;
    const noise = (Math.random() - 0.5) * 1.5;
    let value = baseValue + noise;
    
    const isManuallyModified = i === 23 || i === 24;
    if (isManuallyModified) {
      value = 7.5 + Math.random() * 1.5;
    }

    if (i > 30 && i < 38) {
      value += 3;
    }

    data.push({
      id: generateId('vib'),
      warningId,
      timestamp: randomDate(baseTime, -pointCount * 5 + i * 5),
      value: Math.round(value * 100) / 100,
      isManuallyModified,
      modifiedBy: isManuallyModified ? '张工' : undefined,
      modifiedAt: isManuallyModified ? randomDate(baseTime, -10) : undefined,
    });
  }

  return data;
}

export function generateMockOperationLogs(warningId: string, warningCreatedAt: string): OperationLog[] {
  const baseTime = new Date(warningCreatedAt);
  return [
    {
      id: generateId('log'),
      warningId,
      type: 'threshold_early',
      operator: '李工',
      operatedAt: randomDate(baseTime, -180),
      description: '提前提交阈值表，温度、振动等指标数据',
      affectsConclusion: false,
    },
    {
      id: generateId('log'),
      warningId,
      type: 'vibration_modified',
      operator: '张工',
      operatedAt: randomDate(baseTime, -10),
      description: '手工修改振动曲线数据点',
      affectsConclusion: true,
      beforeChange: '振动值 4.2 mm/s',
      afterChange: '振动值 7.8 mm/s',
    },
    {
      id: generateId('log'),
      warningId,
      type: 'repair_late',
      operator: '王工',
      operatedAt: randomDate(baseTime, 60),
      description: '补填维修单，记录轴承检查情况',
      affectsConclusion: false,
    },
  ];
}

export function generateMockWarningDetail(warning: Warning): WarningDetail {
  const thresholds = generateMockThresholds(warning.id, warning.createdAt);
  const vibrationData = generateMockVibrationData(warning.id, warning.createdAt);
  const operationLogs = generateMockOperationLogs(warning.id, warning.createdAt);
  
  const judgment = generateFaultJudgment({
    thresholds,
    vibrationData,
    warningCreatedAt: warning.createdAt,
  });
  judgment.warningId = warning.id;
  
  const plainReason = generatePlainReason(judgment, warning.deviceName);
  const nextSteps = generateNextSteps(judgment, warning.deviceName);
  const riskLevel = judgment.isAbnormal ? 'high' : warning.status === 'fault' ? 'high' : warning.status === 'warning' ? 'medium' : 'low';

  return {
    ...warning,
    thresholds,
    vibrationData,
    faultJudgment: judgment,
    operationLogs,
    foremanData: {
      warningId: warning.id,
      deviceName: warning.deviceName,
      status: warning.status,
      plainReason,
      nextSteps,
      riskLevel,
    },
  };
}

export function filterWarnings(warnings: Warning[], filters: FilterOptions): Warning[] {
  return warnings.filter(w => {
    if (filters.status && w.status !== filters.status) return false;
    if (filters.deviceName && !w.deviceName.includes(filters.deviceName)) return false;
    if (filters.startDate && new Date(w.createdAt) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(w.createdAt) > new Date(filters.endDate)) return false;
    return true;
  });
}

let mockWarningsCache: Warning[] | null = null;

export function getMockWarnings(): Warning[] {
  if (!mockWarningsCache) {
    mockWarningsCache = generateMockWarnings();
  }
  return mockWarningsCache;
}

export function refreshMockWarnings(): Warning[] {
  mockWarningsCache = generateMockWarnings();
  return mockWarningsCache;
}

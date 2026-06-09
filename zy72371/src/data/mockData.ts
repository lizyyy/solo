import { BatchRecord, ThresholdConfig, BatchStatus, TemperaturePoint, ProcessLog } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const generateTemperatureCurve = (
  batchId: string, 
  baseTemp: number, 
  hasAnomaly: boolean = false,
  hasCorrection: boolean = false
): TemperaturePoint[] => {
  const points: TemperaturePoint[] = [];
  const targetTemps = [
    300, 450, 600, 750, 900, 1000, 1100, 1180, 1220, 1250,
    1250, 1250, 1250, 1230, 1200, 1150, 1050, 900, 700, 500
  ];

  for (let i = 0; i < 20; i++) {
    let temp = targetTemps[i] + (Math.random() - 0.5) * 30 + baseTemp - 1200;
    const isAbnormal = hasAnomaly && (i === 8 || i === 9);
    const isCorrected = hasCorrection && isAbnormal;

    if (isAbnormal && !isCorrected) {
      temp = targetTemps[i] + 60;
    } else if (isCorrected) {
      temp = targetTemps[i] + 15;
    }

    points.push({
      id: generateId(),
      batchId,
      timeIndex: i * 15,
      temperature: Math.round(temp),
      targetTemp: targetTemps[i],
      isAbnormal,
      isCorrected,
      originalTemp: isCorrected ? targetTemps[i] + 60 : undefined
    });
  }

  return points;
};

const createProcessLogs = (
  batchId: string,
  status: BatchStatus
): ProcessLog[] => {
  const logs: ProcessLog[] = [
    {
      id: generateId(),
      batchId,
      action: 'import',
      operator: '质检员小白',
      description: '手写巡检备注导入完成',
      timestamp: new Date('2024-01-15T09:00:00')
    },
    {
      id: generateId(),
      batchId,
      action: 'auto_parse',
      operator: '系统',
      description: '温度数据自动解析完成',
      timestamp: new Date('2024-01-15T09:02:00')
    }
  ];

  if (status === 'pending_review') {
    logs.push({
      id: generateId(),
      batchId,
      action: 'manual_correction',
      operator: '未知操作员',
      description: '检测到第8-9温区有人工涂改痕迹，温度系数被修改，但未填写修正原因',
      timestamp: new Date('2024-01-15T09:05:00'),
      fieldName: 'temperatureCoefficient',
      beforeValue: '原始系数(超限)',
      afterValue: '人工下调(合规)'
    });
  }

  if (status === 'supplemented') {
    logs.push(
      {
        id: generateId(),
        batchId,
        action: 'threshold_check',
        operator: '质检员小白',
        description: '质检员小白补看安全阈值表，发现本批次为老配方产品，不应使用 v2024.01 新口径',
        timestamp: new Date('2024-01-15T09:10:00'),
        fieldName: 'thresholdVersion',
        beforeValue: 'v2024.01 (新口径)',
        afterValue: 'v2023.09 (旧口径)'
      },
      {
        id: generateId(),
        batchId,
        action: 'supplement',
        operator: '质检员小白',
        description: '从安全阈值表补录 v2023.09 旧口径标准，重新判定为正常',
        timestamp: new Date('2024-01-15T09:15:00'),
        fieldName: 'status',
        beforeValue: 'needs_supplement (需补录)',
        afterValue: 'supplemented (已补录)'
      }
    );
  }

  if (status === 'needs_supplement') {
    logs.push(
      {
        id: generateId(),
        batchId,
        action: 'threshold_check',
        operator: '系统',
        description: '按 v2024.01 新口径判定发现异常，但巡检备注提示为老配方产品，请人工核对阈值口径',
        timestamp: new Date('2024-01-15T09:08:00'),
        fieldName: 'abnormalStatus',
        beforeValue: 'pending',
        afterValue: 'needs_supplement'
      }
    );
  }

  if (status === 'normal') {
    logs.push({
      id: generateId(),
      batchId,
      action: 'complete',
      operator: '系统',
      description: '按 v2024.01 口径校验通过，无异常',
      timestamp: new Date('2024-01-15T09:05:00'),
      fieldName: 'status',
      beforeValue: 'imported',
      afterValue: 'normal'
    });
  }

  return logs;
};

export const mockBatches: BatchRecord[] = [
  {
    id: 'batch-001',
    name: '2024-01-15-A批次(正常)',
    materialType: '高铝瓷',
    status: 'normal',
    remark: '升温曲线正常，各温区稳定，无异常波动。巡检员：张三',
    originalRemark: '升温曲线正常，各温区稳定，无异常波动。巡检员：张三',
    remarkHistory: [],
    hasManualCorrection: false,
    source: '手写巡检单 #20240115001',
    originalThresholdVersion: 'v2024.01',
    appliedThresholdVersion: 'v2024.01',
    createdAt: new Date('2024-01-15T09:00:00'),
    updatedAt: new Date('2024-01-15T09:05:00'),
    temperaturePoints: generateTemperatureCurve('batch-001', 1200, false, false),
    processLogs: createProcessLogs('batch-001', 'normal')
  },
  {
    id: 'batch-002',
    name: '2024-01-15-B批次(待复核)',
    materialType: '长石瓷',
    status: 'pending_review',
    remark: '第8-9温区数据有涂改痕迹，人工改过系数但未注明原因。巡检员：李四',
    originalRemark: '第8-9温区数据有涂改痕迹，人工改过系数但未注明原因。巡检员：李四',
    remarkHistory: [],
    hasManualCorrection: true,
    source: '手写巡检单 #20240115002',
    originalThresholdVersion: 'v2024.01',
    appliedThresholdVersion: 'v2024.01',
    createdAt: new Date('2024-01-15T09:30:00'),
    updatedAt: new Date('2024-01-15T09:35:00'),
    temperaturePoints: generateTemperatureCurve('batch-002', 1200, true, true),
    processLogs: createProcessLogs('batch-002', 'pending_review')
  },
  {
    id: 'batch-003',
    name: '2024-01-15-C批次(待补录)',
    materialType: '镁质瓷(老配方)',
    status: 'needs_supplement',
    remark: '按新口径超标，巡检备注提示本批次为老配方产品，请查安全阈值表旧口径。巡检员：王五',
    originalRemark: '按新口径超标，巡检备注提示本批次为老配方产品，请查安全阈值表旧口径。巡检员：王五',
    remarkHistory: [],
    hasManualCorrection: false,
    source: '手写巡检单 #20240115003',
    originalThresholdVersion: 'v2024.01',
    appliedThresholdVersion: 'v2024.01',
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:08:00'),
    temperaturePoints: generateTemperatureCurve('batch-003', 1180, true, false),
    processLogs: createProcessLogs('batch-003', 'needs_supplement')
  }
];

export const mockThresholds: ThresholdConfig[] = [
  {
    id: 'th-001',
    version: 'v2024.01',
    zone: 1,
    minTemp: 280,
    maxTemp: 320,
    warningThreshold: 20,
    isCurrent: true,
    effectiveDate: new Date('2024-01-01'),
    description: '低温预热区'
  },
  {
    id: 'th-002',
    version: 'v2024.01',
    zone: 2,
    minTemp: 430,
    maxTemp: 470,
    warningThreshold: 20,
    isCurrent: true,
    effectiveDate: new Date('2024-01-01'),
    description: '升温区'
  },
  {
    id: 'th-003',
    version: 'v2024.01',
    zone: 3,
    minTemp: 580,
    maxTemp: 620,
    warningThreshold: 20,
    isCurrent: true,
    effectiveDate: new Date('2024-01-01'),
    description: '氧化区'
  },
  {
    id: 'th-004',
    version: 'v2024.01',
    zone: 4,
    minTemp: 1160,
    maxTemp: 1240,
    warningThreshold: 30,
    isCurrent: true,
    effectiveDate: new Date('2024-01-01'),
    description: '高温烧成区'
  },
  {
    id: 'th-005',
    version: 'v2023.09',
    zone: 1,
    minTemp: 260,
    maxTemp: 340,
    warningThreshold: 30,
    isCurrent: false,
    effectiveDate: new Date('2023-09-01'),
    description: '旧口径-低温预热区（老配方适用）'
  },
  {
    id: 'th-006',
    version: 'v2023.09',
    zone: 2,
    minTemp: 410,
    maxTemp: 490,
    warningThreshold: 30,
    isCurrent: false,
    effectiveDate: new Date('2023-09-01'),
    description: '旧口径-升温区（老配方适用）'
  },
  {
    id: 'th-007',
    version: 'v2023.09',
    zone: 3,
    minTemp: 560,
    maxTemp: 640,
    warningThreshold: 30,
    isCurrent: false,
    effectiveDate: new Date('2023-09-01'),
    description: '旧口径-氧化区（老配方适用）'
  },
  {
    id: 'th-008',
    version: 'v2023.09',
    zone: 4,
    minTemp: 1140,
    maxTemp: 1260,
    warningThreshold: 40,
    isCurrent: false,
    effectiveDate: new Date('2023-09-01'),
    description: '旧口径-高温烧成区（老配方适用）'
  }
];

export const sampleDescriptions = {
  normal: {
    title: '正常材料',
    subtitle: '顺利记录 · 无人工修改',
    description: '标准高铝瓷批次，巡检数据完整，温度曲线在安全阈值范围内，无异常点。导入即正常。'
  },
  pending_review: {
    title: '错口径材料',
    subtitle: '人工改过系数 · 没写原因',
    description: '长石瓷批次，发现第8-9温区数据有涂改痕迹。人工改过温度系数但未在备注中说明原因，需留给设备工程师复核。'
  },
  needs_supplement: {
    title: '补录材料',
    subtitle: '从安全阈值表补录旧口径',
    description: '镁质瓷老配方产品，初始用新口径判定异常。需质检员小白去安全阈值表选v2023.09旧口径真实补录，再看后续结果。'
  }
};

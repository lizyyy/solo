import type { WaterQualityRecord, CleaningStep } from '@/types';

const generateCleaningSteps = (
  rawValue: number,
  hasDrift: boolean,
  driftAmount: number,
  scheme: 'standard' | 'strict' = 'standard'
): CleaningStep[] => {
  const steps: CleaningStep[] = [];
  let currentValue = rawValue;

  steps.push({
    id: 'step-1',
    stepOrder: 1,
    stepName: '原始数据',
    inputValue: rawValue,
    outputValue: rawValue,
    description: '从船上传感器采集的原始读数',
    hasIssue: false,
  });

  currentValue = rawValue;
  const outlierValue = scheme === 'strict' ? rawValue * 0.92 : rawValue * 0.95;
  steps.push({
    id: 'step-2',
    stepOrder: 2,
    stepName: '异常值剔除',
    inputValue: currentValue,
    outputValue: outlierValue,
    description: scheme === 'strict' 
      ? '采用3σ准则严格剔除离群数据点' 
      : '采用2σ准则剔除明显异常数据点',
    hasIssue: false,
  });
  currentValue = outlierValue;

  const driftCorrected = hasDrift 
    ? currentValue - driftAmount * (scheme === 'strict' ? 1.1 : 1) 
    : currentValue;
  steps.push({
    id: 'step-3',
    stepOrder: 3,
    stepName: '漂移校正',
    inputValue: currentValue,
    outputValue: driftCorrected,
    description: hasDrift 
      ? `检测到传感器漂移 ${driftAmount.toFixed(2)}，已进行补偿校正` 
      : '传感器工作稳定，无需漂移校正',
    hasIssue: hasDrift,
    issueDetail: hasDrift ? '存在传感器零点漂移，需人工确认' : undefined,
  });
  currentValue = driftCorrected;

  const smoothed = currentValue * (scheme === 'strict' ? 0.98 : 0.99);
  steps.push({
    id: 'step-4',
    stepOrder: 4,
    stepName: '平滑插值',
    inputValue: currentValue,
    outputValue: smoothed,
    description: scheme === 'strict'
      ? '采用五点三次平滑算法降噪'
      : '采用移动平均法进行数据平滑',
    hasIssue: false,
  });
  currentValue = smoothed;

  steps.push({
    id: 'step-5',
    stepOrder: 5,
    stepName: '统计输出',
    inputValue: currentValue,
    outputValue: Number(currentValue.toFixed(2)),
    description: '生成最终清洗结果，保留两位有效数字',
    hasIssue: false,
  });

  return steps;
};

export const mockRecords: WaterQualityRecord[] = [
  {
    id: 'rec-001',
    recordNo: 'SZ-2026-0615-001',
    shipName: '蓝海监测03号',
    measureDate: '2026-06-15',
    measureTime: '08:30',
    location: '1号锚地',
    parameterType: 'dissolved_oxygen',
    rawValue: 7.82,
    cleanedValue: 7.45,
    unit: 'mg/L',
    hasDrift: false,
    driftAmount: 0,
    originalNote: '早班测量，海面平静，仪器读数稳定',
    supplementaryNote: '',
    hasSupplementaryNote: false,
    status: 'confirmed',
    missingEvidence: [],
    cleaningSteps: generateCleaningSteps(7.82, false, 0),
    createdAt: '2026-06-15T08:45:00',
  },
  {
    id: 'rec-002',
    recordNo: 'SZ-2026-0615-002',
    shipName: '蓝海监测03号',
    measureDate: '2026-06-15',
    measureTime: '09:15',
    location: '2号锚地',
    parameterType: 'turbidity',
    rawValue: 15.6,
    cleanedValue: 12.8,
    unit: 'NTU',
    hasDrift: true,
    driftAmount: 1.2,
    originalNote: '浊度偏高，附近有疏浚作业',
    supplementaryNote: '后补：下午14:00重测一次，数值回落到11.3，确认疏浚影响',
    hasSupplementaryNote: true,
    status: 'supplement',
    missingEvidence: ['现场照片', '重测原始数据'],
    cleaningSteps: generateCleaningSteps(15.6, true, 1.2),
    createdAt: '2026-06-15T09:30:00',
  },
  {
    id: 'rec-003',
    recordNo: 'SZ-2026-0615-003',
    shipName: '蓝海监测03号',
    measureDate: '2026-06-15',
    measureTime: '10:00',
    location: '航道入口',
    parameterType: 'ph',
    rawValue: 8.12,
    cleanedValue: 8.05,
    unit: '',
    hasDrift: false,
    driftAmount: 0,
    originalNote: 'pH值正常范围',
    supplementaryNote: '',
    hasSupplementaryNote: false,
    status: 'pending',
    missingEvidence: [],
    cleaningSteps: generateCleaningSteps(8.12, false, 0),
    createdAt: '2026-06-15T10:15:00',
  },
  {
    id: 'rec-004',
    recordNo: 'SZ-2026-0614-001',
    shipName: '蓝海监测01号',
    measureDate: '2026-06-14',
    measureTime: '14:20',
    location: '化工区排污口',
    parameterType: 'dissolved_oxygen',
    rawValue: 4.2,
    cleanedValue: 4.05,
    unit: 'mg/L',
    hasDrift: true,
    driftAmount: 0.3,
    originalNote: '溶解氧偏低，疑似排污影响',
    supplementaryNote: '后补：老何备注——此条数据异常，需与化工区核对排放记录后再确认',
    hasSupplementaryNote: true,
    status: 'returned',
    missingEvidence: ['排污口监测数据', '第三方比对报告'],
    cleaningSteps: generateCleaningSteps(4.2, true, 0.3),
    createdAt: '2026-06-14T14:35:00',
  },
  {
    id: 'rec-005',
    recordNo: 'SZ-2026-0614-002',
    shipName: '蓝海监测01号',
    measureDate: '2026-06-14',
    measureTime: '15:00',
    location: '养殖区',
    parameterType: 'salinity',
    rawValue: 31.2,
    cleanedValue: 30.8,
    unit: '‰',
    hasDrift: false,
    driftAmount: 0,
    originalNote: '盐度正常，与历史数据一致',
    supplementaryNote: '',
    hasSupplementaryNote: false,
    status: 'confirmed',
    missingEvidence: [],
    cleaningSteps: generateCleaningSteps(31.2, false, 0),
    createdAt: '2026-06-14T15:15:00',
  },
  {
    id: 'rec-006',
    recordNo: 'SZ-2026-0613-001',
    shipName: '蓝海监测02号',
    measureDate: '2026-06-13',
    measureTime: '11:00',
    location: '旅游区海滩',
    parameterType: 'temperature',
    rawValue: 23.5,
    cleanedValue: 23.2,
    unit: '°C',
    hasDrift: false,
    driftAmount: 0,
    originalNote: '水温正常，游客较多',
    supplementaryNote: '后补：当日气温28°C，水温与往年同期持平',
    hasSupplementaryNote: true,
    status: 'confirmed',
    missingEvidence: [],
    cleaningSteps: generateCleaningSteps(23.5, false, 0),
    createdAt: '2026-06-13T11:20:00',
  },
  {
    id: 'rec-007',
    recordNo: 'SZ-2026-0613-002',
    shipName: '蓝海监测02号',
    measureDate: '2026-06-13',
    measureTime: '13:30',
    location: '港口东侧',
    parameterType: 'turbidity',
    rawValue: 28.5,
    cleanedValue: 22.1,
    unit: 'NTU',
    hasDrift: true,
    driftAmount: 3.5,
    originalNote: '浊度很高，有船舶漏油报告',
    supplementaryNote: '',
    hasSupplementaryNote: false,
    status: 'supplement',
    missingEvidence: ['油污照片', '船舶调度记录'],
    cleaningSteps: generateCleaningSteps(28.5, true, 3.5),
    createdAt: '2026-06-13T13:45:00',
  },
  {
    id: 'rec-008',
    recordNo: 'SZ-2026-0612-001',
    shipName: '蓝海监测01号',
    measureDate: '2026-06-12',
    measureTime: '09:00',
    location: '航道入口',
    parameterType: 'dissolved_oxygen',
    rawValue: 6.95,
    cleanedValue: 6.72,
    unit: 'mg/L',
    hasDrift: false,
    driftAmount: 0,
    originalNote: '早高峰，船舶通航量大',
    supplementaryNote: '',
    hasSupplementaryNote: false,
    status: 'confirmed',
    missingEvidence: [],
    cleaningSteps: generateCleaningSteps(6.95, false, 0),
    createdAt: '2026-06-12T09:15:00',
  },
  {
    id: 'rec-009',
    recordNo: 'SZ-2026-0612-002',
    shipName: '蓝海监测01号',
    measureDate: '2026-06-12',
    measureTime: '16:45',
    location: '1号锚地',
    parameterType: 'ph',
    rawValue: 7.88,
    cleanedValue: 7.82,
    unit: '',
    hasDrift: true,
    driftAmount: 0.15,
    originalNote: '傍晚测量，pH略降',
    supplementaryNote: '后补：夜间生物活动可能影响pH值，属正常波动范围',
    hasSupplementaryNote: true,
    status: 'pending',
    missingEvidence: [],
    cleaningSteps: generateCleaningSteps(7.88, true, 0.15),
    createdAt: '2026-06-12T17:00:00',
  },
  {
    id: 'rec-010',
    recordNo: 'SZ-2026-0611-001',
    shipName: '蓝海监测03号',
    measureDate: '2026-06-11',
    measureTime: '10:30',
    location: '化工区排污口',
    parameterType: 'salinity',
    rawValue: 33.8,
    cleanedValue: 33.5,
    unit: '‰',
    hasDrift: false,
    driftAmount: 0,
    originalNote: '盐度略高，可能有工业废水排入',
    supplementaryNote: '',
    hasSupplementaryNote: false,
    status: 'returned',
    missingEvidence: ['企业排放自查报告'],
    cleaningSteps: generateCleaningSteps(33.8, false, 0),
    createdAt: '2026-06-11T10:45:00',
  },
];

export const getCleanedValueByScheme = (
  record: WaterQualityRecord,
  schemeId: string
): number => {
  if (schemeId === 'scheme-strict') {
    const steps = generateCleaningSteps(record.rawValue, record.hasDrift, record.driftAmount, 'strict');
    return steps[steps.length - 1].outputValue;
  }
  return record.cleanedValue;
};

export const getCleaningStepsByScheme = (
  record: WaterQualityRecord,
  schemeId: string
): CleaningStep[] => {
  if (schemeId === 'scheme-strict') {
    return generateCleaningSteps(record.rawValue, record.hasDrift, record.driftAmount, 'strict');
  }
  return record.cleaningSteps;
};

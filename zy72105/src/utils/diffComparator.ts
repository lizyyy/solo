import type { Batch, ComparisonDiff, DiffSignificance, DiffType, NoisePredictionResult } from '../types';

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const calculateSignificance = (
  field: string,
  oldValue: unknown,
  newValue: unknown
): DiffSignificance => {
  const highImpactFields = [
    'overallNoiseLevel',
    'assessment',
    'unit',
    'noiseWarning',
    'noiseCritical',
    'resolution',
    'value',
    'unit',
  ];

  const mediumImpactFields = [
    'dominantFrequency',
    'directionalityIndex',
    'confidenceLevel',
    'rotorSpeed',
    'thrust',
    'rotorRadius',
    'bladeCount',
    'chord',
  ];

  if (highImpactFields.some((f) => field.includes(f))) {
    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      const diffPercent = Math.abs((newValue - oldValue) / Math.max(Math.abs(oldValue), 1)) * 100;
      if (diffPercent > 10) return 'high';
      if (diffPercent > 5) return 'medium';
    } else if (oldValue !== newValue) {
      return 'high';
    }
  }

  if (mediumImpactFields.some((f) => field.includes(f))) {
    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      const diffPercent = Math.abs((newValue - oldValue) / Math.max(Math.abs(oldValue), 1)) * 100;
      if (diffPercent > 10) return 'medium';
    }
    return 'low';
  }

  return 'low';
};

const deepCompare = (
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  prefix = ''
): ComparisonDiff[] => {
  const diffs: ComparisonDiff[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const field = prefix ? `${prefix}.${key}` : key;
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (!(key in oldObj)) {
      diffs.push({
        field,
        oldValue: undefined,
        newValue: newVal,
        diffType: 'added' as DiffType,
        significance: calculateSignificance(field, undefined, newVal),
      });
    } else if (!(key in newObj)) {
      diffs.push({
        field,
        oldValue: oldVal,
        newValue: undefined,
        diffType: 'removed' as DiffType,
        significance: calculateSignificance(field, oldVal, undefined),
      });
    } else if (isObject(oldVal) && isObject(newVal)) {
      diffs.push(...deepCompare(oldVal, newVal, field));
    } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffs.push({
          field,
          oldValue: oldVal,
          newValue: newVal,
          diffType: 'modified' as DiffType,
          significance: calculateSignificance(field, oldVal, newVal),
        });
      }
    } else if (oldVal !== newVal) {
      diffs.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
        diffType: 'modified' as DiffType,
        significance: calculateSignificance(field, oldVal, newVal),
      });
    }
  }

  return diffs;
};

export const compareBatches = (oldBatch: Batch, newBatch: Batch): ComparisonDiff[] => {
  const oldObj = JSON.parse(JSON.stringify(oldBatch)) as Record<string, unknown>;
  const newObj = JSON.parse(JSON.stringify(newBatch)) as Record<string, unknown>;

  const ignoredFields = ['id', 'createdAt', 'updatedAt', 'timestamp', 'calculationChain'];
  for (const field of ignoredFields) {
    delete oldObj[field];
    delete newObj[field];
  }

  return deepCompare(oldObj, newObj);
};

export const compareResults = (
  oldResult: NoisePredictionResult,
  newResult: NoisePredictionResult
): ComparisonDiff[] => {
  const oldObj = JSON.parse(JSON.stringify(oldResult)) as Record<string, unknown>;
  const newObj = JSON.parse(JSON.stringify(newResult)) as Record<string, unknown>;

  return deepCompare(oldObj, newObj);
};

export const compareNoteImpact = (
  oldResult: NoisePredictionResult | undefined,
  newResult: NoisePredictionResult
): {
  diffs: ComparisonDiff[];
  impact: 'none' | 'minor' | 'major' | 'critical';
  summary: string;
} => {
  if (!oldResult) {
    return {
      diffs: [],
      impact: 'none',
      summary: '无之前的结果快照可对比',
    };
  }

  const diffs = compareResults(oldResult, newResult);
  const highDiffs = diffs.filter((d) => d.significance === 'high');
  const mediumDiffs = diffs.filter((d) => d.significance === 'medium');

  let impact: 'none' | 'minor' | 'major' | 'critical' = 'none';
  if (highDiffs.length > 0) {
    const assessmentDiff = diffs.find((d) => d.field === 'assessment');
    if (assessmentDiff) {
      impact = 'critical';
    } else {
      impact = 'major';
    }
  } else if (mediumDiffs.length > 0) {
    impact = 'minor';
  }

  let summary = '';
  switch (impact) {
    case 'critical':
      summary = '⚠️ 补录备注导致评估等级变化，属于重大影响';
      break;
    case 'major':
      summary = '📊 补录备注导致关键参数变化，属于较大影响';
      break;
    case 'minor':
      summary = '📝 补录备注导致次要参数变化';
      break;
    default:
      summary = '✅ 补录备注未影响计算结果';
  }

  return { diffs, impact, summary };
};

export const formatDiffValue = (value: unknown): string => {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return `[${value.map(formatDiffValue).join(', ')}]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const getDiffTypeLabel = (type: DiffType): string => {
  const labels: Record<DiffType, string> = {
    added: '新增',
    removed: '删除',
    modified: '修改',
  };
  return labels[type];
};

export const getSignificanceLabel = (sig: DiffSignificance): string => {
  const labels: Record<DiffSignificance, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[sig];
};

export const getFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    'result.overallNoiseLevel': '总噪声级',
    'result.unit': '噪声单位',
    'result.dominantFrequency': '主导频率',
    'result.directionalityIndex': '指向性指数',
    'result.confidenceLevel': '置信度',
    'result.assessment': '评估等级',
    'status': '批次状态',
    'name': '批次名称',
    'experimentRecord.droneModel': '无人机型号',
    'experimentRecord.rotorModel': '旋翼型号',
    'experimentRecord.temperature': '温度',
    'experimentRecord.humidity': '湿度',
    'conflicts.resolution': '冲突解决方案',
  };

  return labels[field] || field;
};

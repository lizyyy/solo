import type { StrainRecord, ThresholdAlert } from '@/types';

export const THRESHOLD = 2500;

export interface CleaningResult {
  cleanedValue: number;
  isOverThreshold: boolean;
  originalValue: number;
  averageValue?: number;
  deviationRate?: number;
  neighboringValues?: number[];
  threshold: number;
}

export const cleanStrainData = (
  originalValue: number,
  neighboringValues: number[] = [],
  threshold: number = THRESHOLD
): CleaningResult => {
  if (originalValue <= threshold) {
    return {
      cleanedValue: originalValue,
      isOverThreshold: false,
      originalValue,
      threshold,
    };
  }

  const averageValue = neighboringValues.length > 0
    ? neighboringValues.reduce((sum, val) => sum + val, 0) / neighboringValues.length
    : originalValue;

  const deviationRate = ((originalValue - averageValue) / averageValue) * 100;

  return {
    cleanedValue: averageValue,
    isOverThreshold: true,
    originalValue,
    averageValue,
    deviationRate: parseFloat(deviationRate.toFixed(1)),
    neighboringValues,
    threshold,
  };
};

export const createThresholdAlert = (
  recordId: string,
  cleaningResult: CleaningResult
): ThresholdAlert | null => {
  if (!cleaningResult.isOverThreshold) return null;

  return {
    id: `ALERT-${Date.now()}`,
    recordId,
    originalValue: cleaningResult.originalValue,
    originalUnit: 'με',
    threshold: cleaningResult.threshold,
    cleanedValue: cleaningResult.averageValue || 0,
    cleanedUnit: 'με',
    deviationRate: cleaningResult.deviationRate || 0,
    neighborIndices: [],
    reviewStatus: 'pending_review' as const,
  };
};

export const calculateNeighboringAverage = (
  allRecords: StrainRecord[],
  currentIndex: number,
  windowSize: number = 3
): number[] => {
  const start = Math.max(0, currentIndex - Math.floor(windowSize / 2));
  const end = Math.min(allRecords.length, currentIndex + Math.ceil(windowSize / 2));

  return allRecords
    .slice(start, end)
    .filter((_, i) => start + i !== currentIndex)
    .map(r => r.originalValue);
};

export const getRecordStatusDescription = (status: string): string => {
  const descriptions: Record<string, string> = {
    normal: '正常记录',
    over_threshold: '超阈值记录',
    supplemented: '补录记录',
    pending_review: '待维修复核',
    conflict: '存在证据冲突',
  };
  return descriptions[status] || status;
};

export const getMaterialTypeDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    normal: '正常材料',
    wrong_caliber: '错口径材料',
    supplemented: '补录材料',
  };
  return descriptions[type] || type;
};

export const validateRecord = (record: StrainRecord): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];

  if (!record.materialName || record.materialName.trim() === '') {
    issues.push('材料名称不能为空');
  }

  if (record.originalValue <= 0) {
    issues.push('原始值必须大于0');
  }

  if (!record.originalUnit || record.originalUnit.trim() === '') {
    issues.push('原始单位不能为空');
  }

  if (!record.cleanedUnit || record.cleanedUnit.trim() === '') {
    issues.push('清洗后单位不能为空');
  }

  if (record.evidenceSources.length === 0) {
    issues.push('至少需要一个证据来源');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const generateRecordId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `REC-${timestamp}-${random}`;
};

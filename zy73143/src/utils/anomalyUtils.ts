import type { BuoyLog, AnomalyType, AnomalySeverity } from '../types';

export const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

interface AnomalyDetectionResult {
  hasAnomaly: boolean;
  type?: AnomalyType;
  severity?: AnomalySeverity;
  description?: string;
}

export const detectLatLngSwapped = (log: BuoyLog): boolean => {
  const { longitude, latitude } = log;
  const chinaLngMin = 73;
  const chinaLngMax = 135;
  const chinaLatMin = 18;
  const chinaLatMax = 54;

  const lngInRange = longitude >= chinaLngMin && longitude <= chinaLngMax;
  const latInRange = latitude >= chinaLatMin && latitude <= chinaLatMax;

  const swappedLngInRange = latitude >= chinaLngMin && latitude <= chinaLngMax;
  const swappedLatInRange = longitude >= chinaLatMin && longitude <= chinaLatMax;

  if (!lngInRange && !latInRange && swappedLngInRange && swappedLatInRange) {
    return true;
  }

  if (Math.abs(longitude) < 60 && Math.abs(latitude) > 90) {
    return true;
  }

  return false;
};

export const detectBuoyLogAnomalies = (
  log: BuoyLog,
  allLogs: BuoyLog[]
): AnomalyDetectionResult[] => {
  const results: AnomalyDetectionResult[] = [];

  if (detectLatLngSwapped(log)) {
    results.push({
      hasAnomaly: true,
      type: 'latlng_swapped',
      severity: 'high',
      description: `经纬度数值疑似反写：经度${log.longitude}不在中国正常范围(73-135)，纬度${log.latitude}超出正常范围`,
    });
  }

  const confirmedLogs = allLogs.filter((l) => l.isConfirmed && l.id !== log.id);
  if (confirmedLogs.length >= 3) {
    const coverages = confirmedLogs.map((l) => l.seagrassCoverage);
    const mean = coverages.reduce((a, b) => a + b, 0) / coverages.length;
    const stdDev = Math.sqrt(
      coverages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / coverages.length
    );

    if (Math.abs(log.seagrassCoverage - mean) > 2 * stdDev) {
      results.push({
        hasAnomaly: true,
        type: 'value_outlier',
        severity: 'medium',
        description: `海草覆盖度${log.seagrassCoverage}%偏离均值（均值${mean.toFixed(1)}%），超出2倍标准差`,
      });
    }
  }

  return results;
};

const normalizeTimeKey = (isoString: string): string => {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const isDuplicateLog = (log: BuoyLog, existingLogs: BuoyLog[]): BuoyLog | null => {
  const newTimeKey = normalizeTimeKey(log.recordTime);

  const duplicate = existingLogs.find((existing) => {
    if (existing.buoyId !== log.buoyId) return false;

    const existingTimeKey = normalizeTimeKey(existing.recordTime);
    if (existingTimeKey === newTimeKey) return true;

    if (log.importBatch && existing.importBatch === log.importBatch) return true;

    return false;
  });

  return duplicate || null;
};

export interface MergeResult {
  merged: BuoyLog;
  preservedFields: string[];
  filledFields: string[];
  changedFields: string[];
  preservedRemark: boolean;
  preservedConfirmed: boolean;
}

export const mergeDuplicateLog = (
  existingLog: BuoyLog,
  newLog: BuoyLog,
  newBatchName: string
): MergeResult => {
  const preservedFields: string[] = [];
  const filledFields: string[] = [];
  const changedFields: string[] = [];

  const preservedRemark = existingLog.remark.trim().length > 0;
  const preservedConfirmed = existingLog.isConfirmed;

  const merged = { ...existingLog };

  const protectedFields = ['remark', 'isConfirmed', 'confirmedAt', 'confirmer', 'id', 'createdAt'];
  const dataFields: (keyof BuoyLog)[] = [
    'temperature',
    'seagrassCoverage',
    'biomass',
    'longitude',
    'latitude',
  ];

  if (preservedRemark) {
    preservedFields.push('remark');
  }
  if (preservedConfirmed) {
    preservedFields.push('isConfirmed', 'confirmedAt', 'confirmer');
  }

  dataFields.forEach((field) => {
    const existingVal = existingLog[field] as number;
    const newVal = newLog[field] as number;

    if (newVal !== undefined && newVal !== null && !Number.isNaN(newVal)) {
      if (existingVal === undefined || existingVal === null || Number.isNaN(existingVal)) {
        (merged as any)[field] = newVal;
        filledFields.push(field);
      } else if (preservedConfirmed) {
        preservedFields.push(field);
      } else if (Math.abs(existingVal - newVal) > 0.0001) {
        changedFields.push(field);
        (merged as any)[field] = newVal;
      }
    }
  });

  if (!merged.remark && newLog.remark) {
    merged.remark = newLog.remark;
    filledFields.push('remark');
  }

  const existingBatches = (merged as any)._importBatches || [existingLog.importBatch];
  if (!existingBatches.includes(newBatchName)) {
    existingBatches.push(newBatchName);
  }
  (merged as any)._importBatches = existingBatches;

  merged.updatedAt = new Date().toISOString();

  return {
    merged,
    preservedFields,
    filledFields,
    changedFields,
    preservedRemark,
    preservedConfirmed,
  };
};

export const getAnomalyTypeLabel = (type: AnomalyType): string => {
  const labels: Record<AnomalyType, string> = {
    latlng_swapped: '经纬度反写',
    value_outlier: '数值异常',
    missing_data: '数据缺失',
    duplicate_log: '重复记录',
  };
  return labels[type] || type;
};

export const getSeverityLabel = (severity: AnomalySeverity): string => {
  const labels: Record<AnomalySeverity, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[severity] || severity;
};

export const getSeverityColor = (severity: AnomalySeverity): string => {
  const colors: Record<AnomalySeverity, string> = {
    low: 'text-yellow-600 bg-yellow-50',
    medium: 'text-orange-600 bg-orange-50',
    high: 'text-red-600 bg-red-50',
  };
  return colors[severity] || 'text-gray-600 bg-gray-50';
};

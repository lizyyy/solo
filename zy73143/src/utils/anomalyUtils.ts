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

export const isDuplicateLog = (log: BuoyLog, existingLogs: BuoyLog[]): BuoyLog | null => {
  const duplicate = existingLogs.find(
    (existing) =>
      existing.buoyId === log.buoyId &&
      new Date(existing.recordTime).getTime() === new Date(log.recordTime).getTime()
  );
  return duplicate || null;
};

export const mergeDuplicateLog = (
  existingLog: BuoyLog,
  newLog: BuoyLog
): { merged: BuoyLog; preservedRemark: boolean } => {
  const preservedRemark = existingLog.remark.trim().length > 0;

  const merged: BuoyLog = {
    ...existingLog,
    temperature: newLog.temperature,
    seagrassCoverage: newLog.seagrassCoverage,
    biomass: newLog.biomass,
    longitude: preservedRemark ? existingLog.longitude : newLog.longitude,
    latitude: preservedRemark ? existingLog.latitude : newLog.latitude,
    remark: preservedRemark ? existingLog.remark : newLog.remark,
    importBatch: existingLog.importBatch,
    updatedAt: new Date().toISOString(),
  };

  return { merged, preservedRemark };
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

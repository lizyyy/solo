import type { AnalysisRecord, AnomalyInfo, AnomalyType } from '../types';

export function detectAnomalies(
  record: AnalysisRecord,
  allRecords: AnalysisRecord[]
): AnomalyInfo[] {
  const anomalies: AnomalyInfo[] = [];

  if (checkShadowTimeError(record)) {
    anomalies.push({
      type: 'SHADOW_TIME_ERROR',
      message: '记录时间不在有效日照时段（6:00-18:00）',
      severity: 'warning',
    });
  }

  if (checkConnectionMismatch(record)) {
    anomalies.push({
      type: 'CONNECTION_MISMATCH',
      message: '串并联配置与计算结果逻辑不符',
      severity: 'error',
    });
  }

  if (checkDuplicateLoss(record)) {
    anomalies.push({
      type: 'DUPLICATE_LOSS',
      message: '总损失率异常，可能存在重复扣减',
      severity: 'error',
    });
  }

  if (checkMissingFields(record)) {
    anomalies.push({
      type: 'MISSING_FIELDS',
      message: '存在必填字段缺失',
      severity: 'error',
    });
  }

  if (checkDuplicateSubmission(record, allRecords)) {
    anomalies.push({
      type: 'DUPLICATE_SUBMISSION',
      message: '检测到重复提交记录',
      severity: 'warning',
    });
  }

  return anomalies;
}

function checkShadowTimeError(record: AnalysisRecord): boolean {
  const hour = new Date(record.timestamp).getHours();
  return hour < 6 || hour > 18;
}

function checkConnectionMismatch(record: AnalysisRecord): boolean {
  const { connectionType, seriesPerString, parallelStrings } = record.arrayConfig;
  const { modules } = record.arrayConfig;
  const totalModules = modules.length;

  if (connectionType === 'series') {
    return seriesPerString !== totalModules || parallelStrings !== 1;
  }

  if (connectionType === 'parallel') {
    return seriesPerString !== 1 || parallelStrings !== totalModules;
  }

  if (connectionType === 'hybrid') {
    return seriesPerString * parallelStrings !== totalModules;
  }

  return false;
}

function checkDuplicateLoss(record: AnalysisRecord): boolean {
  const maxPossibleLoss = record.powerResults.reduce(
    (sum, r) => sum + r.theoreticalPower,
    0
  );
  return record.totalLoss > maxPossibleLoss * 0.95;
}

function checkMissingFields(record: AnalysisRecord): boolean {
  if (!record.arrayConfig || !record.shadowConfig) return true;
  if (!record.powerResults || record.powerResults.length === 0) return true;
  if (!record.shadingResults || record.shadingResults.length === 0) return true;
  return false;
}

function checkDuplicateSubmission(
  record: AnalysisRecord,
  allRecords: AnalysisRecord[]
): boolean {
  return allRecords.some(
    (r) =>
      r.id !== record.id &&
      r.batchId === record.batchId &&
      Math.abs(r.timestamp - record.timestamp) < 60000 &&
      Math.abs(r.totalPower - record.totalPower) < 0.01
  );
}

export function getDataQuality(anomalies: AnomalyInfo[]): 'normal' | 'pending' | 'anomaly' {
  if (anomalies.some((a) => a.severity === 'error')) {
    return 'anomaly';
  }
  if (anomalies.some((a) => a.severity === 'warning')) {
    return 'pending';
  }
  return 'normal';
}

export function getAnomalyTypeName(type: AnomalyType): string {
  const names: Record<AnomalyType, string> = {
    SHADOW_TIME_ERROR: '阴影时间错误',
    CONNECTION_MISMATCH: '串并联混淆',
    DUPLICATE_LOSS: '功率重复扣减',
    MISSING_FIELDS: '缺字段',
    DUPLICATE_SUBMISSION: '重复提交',
  };
  return names[type];
}

export function getStatusName(status: string): string {
  const names: Record<string, string> = {
    normal: '正常',
    supplement: '补录',
    withdrawn: '撤回',
    duplicate: '重复',
  };
  return names[status] || status;
}

export function getQualityName(quality: string): string {
  const names: Record<string, string> = {
    normal: '正常',
    pending: '待确认',
    anomaly: '异常',
  };
  return names[quality] || quality;
}

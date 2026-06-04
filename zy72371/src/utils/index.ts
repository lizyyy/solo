import { TemperaturePoint, ThresholdConfig, ValidationResult, BatchStatus } from '../types';

export const formatDate = (date: Date): string => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const getStatusLabel = (status: BatchStatus): string => {
  const labels: Record<BatchStatus, string> = {
    normal: '正常',
    pending_review: '待复核',
    supplemented: '已补录'
  };
  return labels[status];
};

export const getStatusColor = (status: BatchStatus): string => {
  const colors: Record<BatchStatus, string> = {
    normal: 'bg-success',
    pending_review: 'bg-warning',
    supplemented: 'bg-supplemented'
  };
  return colors[status];
};

export const validateTemperature = (
  point: TemperaturePoint,
  thresholds: ThresholdConfig[]
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const zone = Math.ceil((point.timeIndex / 60) + 1);
  const threshold = thresholds.find(t => t.zone === zone && t.isCurrent);

  if (!threshold) {
    return { isValid: true, errors: [], warnings: [] };
  }

  const tempDiff = point.temperature - point.targetTemp;
  
  if (point.temperature > threshold.maxTemp) {
    const overAmount = point.temperature - threshold.maxTemp;
    errors.push(`第${formatTime(point.timeIndex)}温度超过上限 ${overAmount}℃，当前 ${point.temperature}℃，上限 ${threshold.maxTemp}℃`);
  }
  
  if (point.temperature < threshold.minTemp) {
    const underAmount = threshold.minTemp - point.temperature;
    errors.push(`第${formatTime(point.timeIndex)}温度低于下限 ${underAmount}℃，当前 ${point.temperature}℃，下限 ${threshold.minTemp}℃`);
  }

  if (Math.abs(tempDiff) > threshold.warningThreshold) {
    warnings.push(`第${formatTime(point.timeIndex)}温度偏离目标值 ${tempDiff > 0 ? '+' : ''}${tempDiff}℃，请注意监控`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const generateFriendlyError = (errorCode: string, context?: Record<string, unknown>): string => {
  const errorMessages: Record<string, string> = {
    'temp_out_of_range': `温度超出安全范围，请检查第${context?.time || '--'}分钟的数据`,
    'manual_correction_no_reason': '发现人工修改痕迹，但未填写修正原因，请设备工程师复核',
    'threshold_version_mismatch': '口径版本不匹配，请检查安全阈值表确认适用版本',
    'batch_not_found': '未找到该批次记录，请确认批次号是否正确',
    'import_failed': '数据导入失败，请检查手写备注格式是否正确',
    'parse_error': '数据解析出错，部分温度值可能无法识别'
  };

  return errorMessages[errorCode] || '发生未知错误，请联系系统管理员';
};

export const calculateCurveStats = (points: TemperaturePoint[]) => {
  const temps = points.map(p => p.temperature);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const abnormalCount = points.filter(p => p.isAbnormal).length;
  const correctedCount = points.filter(p => p.isCorrected).length;

  return {
    maxTemp: Math.round(maxTemp),
    minTemp: Math.round(minTemp),
    avgTemp: Math.round(avgTemp),
    abnormalCount,
    correctedCount,
    totalPoints: points.length
  };
};

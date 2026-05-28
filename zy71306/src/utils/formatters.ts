import { CalibrationError, RadiusUnit, Severity } from '../types/calibration';

export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals);
};

export const formatTorque = (torque: number): string => {
  return `${formatNumber(torque, 3)} mN·m`;
};

export const formatPressure = (pressure: number): string => {
  return `${formatNumber(pressure, 2)} g`;
};

export const formatWearLevel = (level: number): string => {
  return `${Math.round(level)}%`;
};

export const formatAntiSkating = (value: number): string => {
  return formatNumber(value, 2);
};

export const formatRadius = (radius: number, unit: RadiusUnit): string => {
  return `${formatNumber(radius, 1)} ${unit}`;
};

export const formatTonearmLength = (length: number): string => {
  return `${Math.round(length)} mm`;
};

export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getWearLevelColor = (level: number): string => {
  if (level < 30) return '#2E7D32';
  if (level < 60) return '#F59E0B';
  return '#C41E3A';
};

export const getSeverityColor = (severity: Severity): string => {
  switch (severity) {
    case 'low':
      return '#3B82F6';
    case 'medium':
      return '#F59E0B';
    case 'high':
      return '#C41E3A';
  }
};

export const getSeverityLabel = (severity: Severity): string => {
  switch (severity) {
    case 'low':
      return '提示';
    case 'medium':
      return '警告';
    case 'high':
      return '危险';
  }
};

export const formatErrors = (errors: CalibrationError[]): string => {
  if (errors.length === 0) return '无';
  return errors.map(e => `[${getSeverityLabel(e.severity)}] ${e.message}`).join('; ');
};

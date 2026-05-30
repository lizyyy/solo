import type { CornerData } from '../types';

export const calculateCentripetalForce = (speedKmh: number, radiusM: number): number => {
  const speedMs = speedKmh / 3.6;
  const gForce = (speedMs * speedMs) / (radiusM * 9.81);
  return Math.round(gForce * 100) / 100;
};

export const getGripThresholdByTire = (tireType?: string): number => {
  const thresholds: Record<string, number> = {
    'Slick Soft': 1.8,
    'Slick Medium': 1.6,
    'Slick Hard': 1.4,
    'Wet': 1.2,
    'Street': 1.0,
  };
  return thresholds[tireType || ''] || 1.5;
};

export const calculateGripUtilization = (
  centripetalForce: number,
  gripThreshold: number
): number => {
  return Math.round((centripetalForce / gripThreshold) * 100);
};

export const determineStatus = (
  gripUtilization: number,
  isTireMissing: boolean
): 'normal' | 'warning' | 'danger' | 'incomplete' => {
  if (isTireMissing) return 'incomplete';
  if (gripUtilization >= 100) return 'danger';
  if (gripUtilization >= 85) return 'warning';
  return 'normal';
};

export const updateCornerCalculations = (corner: CornerData): CornerData => {
  const centripetalForce = calculateCentripetalForce(corner.speed.value, corner.radius.value);
  const gripThreshold = getGripThresholdByTire(corner.tire.type);
  const gripUtilization = calculateGripUtilization(centripetalForce, gripThreshold);
  const status = determineStatus(gripUtilization, corner.tire.isMissing);

  return {
    ...corner,
    centripetalForce,
    gripThreshold,
    gripUtilization,
    status,
  };
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    normal: '#2A9D8F',
    warning: '#F4A261',
    danger: '#E76F51',
    incomplete: '#6B7280',
  };
  return colors[status] || '#6B7280';
};

export const getStatusText = (status: string): string => {
  const texts: Record<string, string> = {
    normal: '抓地匹配良好',
    warning: '接近抓地阈值',
    danger: '超出抓地阈值',
    incomplete: '数据待补充',
  };
  return texts[status] || '未知状态';
};

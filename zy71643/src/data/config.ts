import type { DetectionConfig } from '../types';

export const defaultDetectionConfig: DetectionConfig = {
  waterElectricMinDist: 0.5,
  waterGasMinDist: 0.5,
  electricGasMinDist: 1.0,
  sameTypeMinDist: 0.3,
  elevationTolerance: 0.1,
  autoCorrectUnit: true,
};

export const pipelineColors: Record<string, string> = {
  water: '#1976d2',
  electric: '#f57c00',
  gas: '#fbc02d',
};

export const collisionColors: Record<string, string> = {
  critical: '#e53935',
  warning: '#fb8c00',
  info: '#43a047',
};

export const collisionTypeLabels: Record<string, string> = {
  intersect: '管线交叉',
  distance: '净距不足',
  elevation: '标高异常',
  duplicate: '管线重叠',
  missing: '数据缺项',
};

export const statusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
};

export const dataSourceLabels: Record<string, string> = {
  survey: '实测数据',
  design: '设计数据',
  corrected: '人工修正',
  duplicate: '重复数据',
};

export const pipelineTypeLabels: Record<string, string> = {
  water: '给排水',
  electric: '电缆',
  gas: '燃气',
};

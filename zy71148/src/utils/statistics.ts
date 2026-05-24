import { IceData, Statistics, ThicknessSample } from '../types';

export const calculateStatistics = (
  data: IceData,
  samples: ThicknessSample[],
  timestamp: number
): Statistics => {
  const validSamples = samples.filter((s) => s.status !== 'missing');
  const thicknesses = validSamples.map((s) => s.thickness);

  const avgThickness = thicknesses.length > 0
    ? thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length
    : 0;
  const minThickness = thicknesses.length > 0 ? Math.min(...thicknesses) : 0;
  const maxThickness = thicknesses.length > 0 ? Math.max(...thicknesses) : 0;

  const normalCount = samples.filter((s) => s.status === 'normal').length;
  const warningCount = samples.filter((s) => s.status === 'warning').length;
  const criticalCount = samples.filter((s) => s.status === 'critical').length;
  const missingCount = samples.filter((s) => s.status === 'missing').length;

  const currentSnapshot = data.snapshots.find((s) => s.timestamp === timestamp);
  const temperatures = currentSnapshot?.temperatureReadings.map((r) => r.temperature) || [];
  const avgTemperature = temperatures.length > 0
    ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length
    : 0;

  const pendingRepairs = data.repairAreas.filter(
    (r) => !r.retested && r.endTime <= timestamp
  ).length;

  return {
    avgThickness,
    minThickness,
    maxThickness,
    normalCount,
    warningCount,
    criticalCount,
    missingCount,
    avgTemperature,
    pendingRepairs,
  };
};

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDuration = (ms: number): string => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

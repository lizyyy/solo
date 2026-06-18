import type { Anomaly } from '../types';
import { mockLogs } from './mockLogs';
import { PARAMETER_THRESHOLDS } from '../types';

const generateId = () => `anomaly-${Math.random().toString(36).substr(2, 9)}`;

const statusDistribution: Anomaly['status'][] = ['pending', 'pending', 'pending', 'processing', 'processing', 'resolved'];

const anomaliesFromLogs: Anomaly[] = [];

for (const log of mockLogs) {
  const paramKeys = Object.keys(log.parameters) as (keyof typeof log.parameters)[];
  const isBoundary = log.isBoundarySample;

  for (const param of paramKeys) {
    const threshold = PARAMETER_THRESHOLDS[param].max;
    const value = log.parameters[param];
    if (value > threshold) {
      const exceedRatio = value / threshold;

      let level: Anomaly['level'] = 'low';
      if (exceedRatio > 2 || isBoundary) level = 'critical';
      else if (exceedRatio > 1.5) level = 'high';
      else if (exceedRatio > 1.2) level = 'medium';

      anomaliesFromLogs.push({
        id: generateId(),
        buoyId: log.buoyId,
        logId: log.id,
        timestamp: log.timestamp,
        type: isBoundary ? 'boundary' : 'parameter',
        level,
        parameter: param,
        value,
        threshold,
        status: statusDistribution[Math.floor(Math.random() * statusDistribution.length)],
        description: isBoundary
          ? `边界样本异常：${PARAMETER_THRESHOLDS[param].name} ${value.toFixed(2)} ${PARAMETER_THRESHOLDS[param].unit}，超过阈值 ${threshold} ${PARAMETER_THRESHOLDS[param].unit}`
          : `参数${PARAMETER_THRESHOLDS[param].name}超标：${value.toFixed(2)} ${PARAMETER_THRESHOLDS[param].unit}，阈值 ${threshold} ${PARAMETER_THRESHOLDS[param].unit}`,
        handler: undefined,
        handleNote: undefined,
      });
    }
  }
}

const trendAnomalies: Anomaly[] = [
  {
    id: generateId(),
    buoyId: 'buoy-001',
    logId: mockLogs.find((l) => l.buoyId === 'buoy-001')?.id,
    timestamp: Date.now() - 12 * 60 * 60 * 1000,
    type: 'trend',
    level: 'high',
    parameter: 'turbidity',
    value: 12.5,
    threshold: 10,
    status: 'processing',
    description: '趋势异常：浊度连续 6 小时呈上升趋势，累计升高 4.2 NTU',
    handler: '老何',
    handleNote: '已联系监测船前往现场核查',
  },
  {
    id: generateId(),
    buoyId: 'buoy-006',
    logId: mockLogs.find((l) => l.buoyId === 'buoy-006')?.id,
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    type: 'trend',
    level: 'medium',
    parameter: 'dissolvedOxygen',
    value: 5.2,
    threshold: 5,
    status: 'resolved',
    description: '趋势异常：溶解氧连续 12 小时呈下降趋势，最低至 4.8 mg/L',
    handler: '老何',
    handleNote: '已排查为潮汐影响，水质已恢复正常',
  },
];

export const mockAnomalies: Anomaly[] = [...anomaliesFromLogs, ...trendAnomalies];

export const getAnomaliesByLogId = (logId: string): Anomaly[] => {
  return mockAnomalies.filter((a) => a.logId === logId);
};

export const getAnomaliesByBuoyId = (buoyId: string): Anomaly[] => {
  return mockAnomalies.filter((a) => a.buoyId === buoyId);
};

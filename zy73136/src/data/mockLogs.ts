import type { BuoyLog, WaterQualityParams, AffectedArea, Anomaly } from '../types';
import { mockBuoys } from './mockBuoys';

const generateId = () => `log-${Math.random().toString(36).substr(2, 9)}`;

function generateNormalParams(baseParams: WaterQualityParams, variance: number = 0.1): WaterQualityParams {
  return {
    ph: baseParams.ph + (Math.random() - 0.5) * variance * 2,
    dissolvedOxygen: baseParams.dissolvedOxygen + (Math.random() - 0.5) * variance * 4,
    turbidity: baseParams.turbidity + (Math.random() - 0.5) * variance * 6,
    temperature: baseParams.temperature + (Math.random() - 0.5) * variance * 4,
    salinity: baseParams.salinity + (Math.random() - 0.5) * variance * 3,
    ammoniaNitrogen: baseParams.ammoniaNitrogen + (Math.random() - 0.5) * variance * 1.5,
  };
}

function calculateAffectedArea(buoyId: string, anomalyLevel: number): AffectedArea {
  const buoy = mockBuoys.find(b => b.id === buoyId)!;
  const radius = 0.5 + anomalyLevel * 0.3;
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.cos(buoy.lat * Math.PI / 180));

  return {
    latRange: [buoy.lat - latDelta, buoy.lat + latDelta],
    lngRange: [buoy.lng - lngDelta, buoy.lng + lngDelta],
    radius,
  };
}

const now = Date.now();
const oneHour = 60 * 60 * 1000;
const sevenDays = 7 * 24 * oneHour;
const startTime = now - sevenDays;

const logs: BuoyLog[] = [];

for (let buoy of mockBuoys) {
  for (let t = startTime; t <= now; t += oneHour) {
    const params = generateNormalParams(buoy.parameters);
    const isAnomaly = Math.random() < 0.08;

    const isBoundarySample = false;
    const sourceRow = null;
    const affectedArea = isAnomaly ? calculateAffectedArea(buoy.id, Math.random() * 3) : undefined;

    logs.push({
      id: generateId(),
      buoyId: buoy.id,
      timestamp: t,
      parameters: params,
      isBoundarySample,
      sourceRow: sourceRow || undefined,
      affectedArea,
      remark: undefined,
      anomalies: [],
    });
  }
}

const boundaryLogIndex = logs.findIndex(l => l.buoyId === 'buoy-003' && l.timestamp > startTime + 3 * 24 * oneHour);
if (boundaryLogIndex !== -1) {
  const boundaryTime = startTime + 3 * 24 * oneHour + 37 * 60 * 1000;
  logs[boundaryLogIndex] = {
    ...logs[boundaryLogIndex],
    id: 'log-boundary-sample-001',
    timestamp: boundaryTime,
    parameters: {
      ph: 10.2,
      dissolvedOxygen: 2.1,
      turbidity: 45.0,
      temperature: 32.5,
      salinity: 18.3,
      ammoniaNitrogen: 5.8,
    },
    isBoundarySample: true,
    sourceRow: '手动补录-06-15-03:37-异常应急监测',
    affectedArea: calculateAffectedArea('buoy-003', 3),
    remark: '边界样本：工业排水口应急监测数据，多参数同时接近临界值',
    anomalies: [],
  };
}

const logsWithRemarks = logs.map(log => {
  if (log.buoyId === 'buoy-002' && log.timestamp > startTime + 5 * 24 * oneHour && log.timestamp < startTime + 5 * 24 * oneHour + 5 * oneHour) {
    return {
      ...log,
      remark: '养殖区投药期间监测数据，氨氮偏高属正常现象',
    };
  }
  return log;
});

export const mockLogs: BuoyLog[] = logsWithRemarks;

export const getBoundarySampleLog = (): BuoyLog | undefined => {
  return mockLogs.find(l => l.isBoundarySample);
};

export function assignAnomaliesToLogs(anomalies: Anomaly[]): BuoyLog[] {
  return mockLogs.map(log => {
    const logAnomalies = anomalies.filter(a => a.logId === log.id);
    if (logAnomalies.length > 0) {
      return { ...log, anomalies: logAnomalies };
    }
    return log;
  });
}

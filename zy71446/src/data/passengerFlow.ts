import { CrowdDataPoint } from '../types/simulation';
import { timeToMinutes } from '../utils/timeUtils';
import { zones } from './stationConfig';

interface FlowPattern {
  peakTime: string;
  baseMultiplier: number;
  noiseFactor: number;
}

const zoneFlowPatterns: Record<string, FlowPattern> = {
  concourse_main: { peakTime: '08:15', baseMultiplier: 1.0, noiseFactor: 0.1 },
  platform_line1: { peakTime: '08:20', baseMultiplier: 0.9, noiseFactor: 0.15 },
  platform_line10: { peakTime: '08:30', baseMultiplier: 0.85, noiseFactor: 0.12 },
  escalator_group_a: { peakTime: '08:15', baseMultiplier: 0.7, noiseFactor: 0.2 },
  escalator_group_b: { peakTime: '08:25', baseMultiplier: 0.65, noiseFactor: 0.18 },
  turnstile_north: { peakTime: '08:10', baseMultiplier: 0.8, noiseFactor: 0.1 },
  turnstile_south: { peakTime: '08:05', baseMultiplier: 0.5, noiseFactor: 0.08 },
  corridor_main: { peakTime: '08:15', baseMultiplier: 0.75, noiseFactor: 0.1 },
};

function gaussian(x: number, mean: number, stdDev: number): number {
  return Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
}

function generateNoise(factor: number): number {
  return (Math.random() - 0.5) * 2 * factor;
}

export function generateCrowdData(time: string): Map<string, CrowdDataPoint> {
  const currentMinutes = timeToMinutes(time);
  const result = new Map<string, CrowdDataPoint>();

  zones.forEach((zone) => {
    const pattern = zoneFlowPatterns[zone.id];
    if (!pattern) return;

    const peakMinutes = timeToMinutes(pattern.peakTime);
    const stdDev = 45;

    const timeFactor = gaussian(currentMinutes, peakMinutes, stdDev);
    const noise = generateNoise(pattern.noiseFactor);
    const multiplier = Math.max(0, pattern.baseMultiplier * timeFactor * (1 + noise));

    const count = Math.floor(zone.capacity * multiplier);
    const density = count / (zone.size[0] * zone.size[2]);

    const baseFlow = Math.floor(count * 0.3);
    const flowDirection = currentMinutes < peakMinutes ? 1 : -1;
    const flowIn = flowDirection > 0 ? baseFlow : Math.floor(baseFlow * 0.3);
    const flowOut = flowDirection > 0 ? Math.floor(baseFlow * 0.3) : baseFlow;

    result.set(zone.id, {
      zoneId: zone.id,
      count: Math.min(count, zone.capacity * 1.3),
      density,
      flowIn,
      flowOut,
      timestamp: time,
    });
  });

  return result;
}

export function generateHistoricalCrowdData(
  startTime: string,
  endTime: string,
  stepMinutes: number = 5
): Map<string, CrowdDataPoint[]> {
  const result = new Map<string, CrowdDataPoint[]>();
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  zones.forEach((zone) => {
    result.set(zone.id, []);
  });

  while (current <= end) {
    const timeStr = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
    const data = generateCrowdData(timeStr);

    data.forEach((point, zoneId) => {
      const arr = result.get(zoneId);
      if (arr) arr.push(point);
    });

    current += stepMinutes;
  }

  return result;
}

export function generateAnomalyCrowdData(
  baseTime: string,
  anomalyType: 'over_capacity' | 'reflow',
  zoneId: string
): Map<string, CrowdDataPoint> {
  const baseData = generateCrowdData(baseTime);
  const zoneData = baseData.get(zoneId);

  if (zoneData) {
    if (anomalyType === 'over_capacity') {
      const zone = zones.find((z) => z.id === zoneId);
      if (zone) {
        zoneData.count = Math.floor(zone.capacity * 1.4);
        zoneData.density = zoneData.count / (zone.size[0] * zone.size[2]);
      }
    } else if (anomalyType === 'reflow') {
      const temp = zoneData.flowIn;
      zoneData.flowIn = zoneData.flowOut;
      zoneData.flowOut = temp;
    }
  }

  return baseData;
}

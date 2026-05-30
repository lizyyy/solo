import { CrowdDataPoint, Zone, DeviceStatus, PeakHourConfig } from '../types/simulation';
import { generateCrowdData, generateAnomalyCrowdData } from '../data/passengerFlow';
import { zones } from '../data/stationConfig';
import { timeToMinutes } from '../utils/timeUtils';

export class CrowdEngine {
  private historicalData: Map<string, CrowdDataPoint[]> = new Map();

  constructor() {
    zones.forEach((zone) => {
      this.historicalData.set(zone.id, []);
    });
  }

  computeCrowdDistribution(time: string): Map<string, CrowdDataPoint> {
    return generateCrowdData(time);
  }

  computeFlowBetweenZones(
    fromZone: string,
    toZone: string,
    time: string
  ): number {
    const distribution = this.computeCrowdDistribution(time);
    const fromData = distribution.get(fromZone);
    const toData = distribution.get(toZone);

    if (!fromData || !toData) return 0;

    const avgFlow = (fromData.flowOut + toData.flowIn) / 2;
    const timeFactor = this.getTimeFactor(time);

    return Math.floor(avgFlow * timeFactor);
  }

  applyDeviceConstraints(
    distribution: Map<string, CrowdDataPoint>,
    devices: DeviceStatus[],
    time: string
  ): Map<string, CrowdDataPoint> {
    const result = new Map(distribution);

    devices.forEach((device) => {
      if (device.status === 'fault' || device.status === 'closed') {
        const relatedZones = this.getZonesForDevice(device.deviceId);
        relatedZones.forEach((zoneId) => {
          const data = result.get(zoneId);
          if (data) {
            data.count = Math.floor(data.count * 1.15);
            data.density = data.count / (this.getZoneSize(zoneId) || 1);
          }
        });
      }
    });

    return result;
  }

  detectReflow(
    zoneId: string,
    currentData: CrowdDataPoint,
    historicalData: CrowdDataPoint[]
  ): boolean {
    if (historicalData.length < 5) return false;

    const recentData = historicalData.slice(-5);
    let reflowCount = 0;

    recentData.forEach((data) => {
      if (data.flowOut > data.flowIn * 1.3) {
        reflowCount++;
      }
    });

    return reflowCount >= 3 && currentData.flowOut > currentData.flowIn * 1.3;
  }

  private getTimeFactor(time: string): number {
    const minutes = timeToMinutes(time);
    const peakMinutes = timeToMinutes('08:15');
    const diff = Math.abs(minutes - peakMinutes);
    return Math.max(0.3, 1 - diff / 120);
  }

  private getZonesForDevice(deviceId: string): string[] {
    if (deviceId.startsWith('ts_n')) return ['turnstile_north', 'concourse_main'];
    if (deviceId.startsWith('ts_s')) return ['turnstile_south', 'concourse_main'];
    if (deviceId.startsWith('esc_1')) return ['escalator_group_a', 'concourse_main', 'platform_line1'];
    if (deviceId.startsWith('esc_10')) return ['escalator_group_b', 'concourse_main', 'platform_line10'];
    return [];
  }

  private getZoneSize(zoneId: string): number {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return 1;
    return zone.size[0] * zone.size[2];
  }

  updateHistoricalData(time: string, data: CrowdDataPoint): void {
    const zoneData = this.historicalData.get(data.zoneId);
    if (zoneData) {
      zoneData.push(data);
      if (zoneData.length > 60) {
        zoneData.shift();
      }
    }
  }

  getHistoricalData(zoneId: string): CrowdDataPoint[] {
    return this.historicalData.get(zoneId) || [];
  }

  injectAnomaly(
    time: string,
    anomalyType: 'over_capacity' | 'reflow',
    zoneId: string
  ): Map<string, CrowdDataPoint> {
    return generateAnomalyCrowdData(time, anomalyType, zoneId);
  }

  static getZoneCapacity(zoneId: string): number {
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.capacity || 100;
  }

  static isPeakHour(time: string, config: PeakHourConfig): boolean {
    const t = timeToMinutes(time);
    const s = timeToMinutes(config.startTime);
    const e = timeToMinutes(config.endTime);
    return t >= s && t <= e;
  }
}

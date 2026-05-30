import { CrowdDataPoint, DeviceStatus, PeakHourConfig } from '../types/simulation';
import { Anomaly, AnomalyType, Severity, EvidenceItem } from '../types/anomalies';
import { Escalator } from '../types/devices';
import { zones, escalators, peakHourConfig } from '../data/stationConfig';
import { CrowdEngine } from './CrowdEngine';
import { generateTimestamp } from '../utils/timeUtils';

interface DetectionResult {
  anomalies: Anomaly[];
  hasDataConflict: boolean;
  conflictData?: {
    concourse?: object;
    turnstile?: object;
    escalator?: object;
    confidence?: object;
  };
}

export class AnomalyDetector {
  private activeAnomalies: Map<string, Anomaly> = new Map();
  private overCapacityDuration: Map<string, number> = new Map();

  detectAll(
    crowdData: Map<string, CrowdDataPoint>,
    devices: DeviceStatus[],
    time: string,
    history: Anomaly[]
  ): DetectionResult {
    const anomalies: Anomaly[] = [];
    const activeIds = new Set<string>();

    zones.forEach((zone) => {
      const data = crowdData.get(zone.id);
      if (!data) return;

      const capacityResult = this.checkOverCapacity(zone, data, time);
      if (capacityResult) {
        anomalies.push(capacityResult);
        activeIds.add(capacityResult.id);
      }

      const warningResult = this.checkCapacityWarning(zone, data, time);
      if (warningResult && !capacityResult) {
        anomalies.push(warningResult);
        activeIds.add(warningResult.id);
      }
    });

    escalators.forEach((esc) => {
      const wrongDirResult = this.checkEscalatorDirection(esc, peakHourConfig, time);
      if (wrongDirResult) {
        anomalies.push(wrongDirResult);
        activeIds.add(wrongDirResult.id);
      }

      const stopResult = this.checkEscalatorStop(esc, time);
      if (stopResult) {
        anomalies.push(stopResult);
        activeIds.add(stopResult.id);
      }
    });

    const conflictResult = this.checkDataConflict(crowdData, devices, time);
    if (conflictResult.hasConflict && conflictResult.anomaly) {
      anomalies.push(conflictResult.anomaly);
      activeIds.add(conflictResult.anomaly.id);
    }

    history.forEach((anom) => {
      if (anom.status === 'active' && !activeIds.has(anom.id)) {
        const updated = { ...anom, endTime: time, status: 'resolved' as const };
        anomalies.push(updated);
      }
    });

    return {
      anomalies,
      hasDataConflict: conflictResult.hasConflict,
      conflictData: conflictResult.conflictData,
    };
  }

  checkOverCapacity(zone: typeof zones[0], data: CrowdDataPoint, time: string): Anomaly | null {
    const percentage = (data.count / zone.capacity) * 100;

    if (percentage >= 120) {
      const duration = (this.overCapacityDuration.get(zone.id) || 0) + 1;
      this.overCapacityDuration.set(zone.id, duration);

      if (duration >= 3) {
        return this.createAnomaly(
          'over_capacity',
          'high',
          zone.name,
          zone.id,
          time,
          { count: data.count, capacity: zone.capacity, percentage, duration },
          [
            this.createEvidence('zone_sensor', { count: data.count, density: data.density }, time, 0.85),
            this.createEvidence('capacity_config', { capacity: zone.capacity }, time, 1.0),
          ]
        );
      }
    } else {
      this.overCapacityDuration.set(zone.id, 0);
    }

    return null;
  }

  checkCapacityWarning(zone: typeof zones[0], data: CrowdDataPoint, time: string): Anomaly | null {
    const percentage = (data.count / zone.capacity) * 100;

    if (percentage >= 90 && percentage < 120) {
      return this.createAnomaly(
        'capacity_warning',
        'medium',
        zone.name,
        zone.id,
        time,
        { count: data.count, capacity: zone.capacity, percentage },
        [
          this.createEvidence('zone_sensor', { count: data.count }, time, 0.85),
        ]
      );
    }

    return null;
  }

  checkEscalatorDirection(
    escalator: Escalator,
    config: PeakHourConfig,
    time: string
  ): Anomaly | null {
    const isPeakHour = CrowdEngine.isPeakHour(time, config);

    if (isPeakHour &&
        escalator.expectedDirection &&
        escalator.direction !== 'stopped' &&
        escalator.direction !== escalator.expectedDirection) {
      return this.createAnomaly(
        'wrong_direction',
        'high',
        escalator.name,
        this.getZoneForEscalator(escalator.id),
        time,
        { directionContrast: 0.8, passengerCount: 45 },
        [
          this.createEvidence('escalator_controller', { direction: escalator.direction }, time, 0.95),
          this.createEvidence('peak_hour_config', { expectedDirection: escalator.expectedDirection }, time, 1.0),
        ]
      );
    }

    return null;
  }

  checkEscalatorStop(escalator: Escalator, time: string): Anomaly | null {
    if (escalator.direction === 'stopped' && !escalator.hasMaintenanceRecord) {
      return this.createAnomaly(
        'escalator_stop',
        'medium',
        escalator.name,
        this.getZoneForEscalator(escalator.id),
        time,
        { affectedPassengers: 120, downtimeMinutes: 0 },
        [
          this.createEvidence('escalator_controller', { status: 'stopped' }, time, 1.0),
          this.createEvidence('maintenance_system', { hasRecord: false }, time, 0.9),
        ]
      );
    }

    return null;
  }

  checkDataConflict(
    crowdData: Map<string, CrowdDataPoint>,
    devices: DeviceStatus[],
    time: string
  ): { hasConflict: boolean; anomaly?: Anomaly; conflictData?: object } {
    const concourseData = crowdData.get('concourse_main');
    const turnstileDevices = devices.filter((d) => d.deviceId.startsWith('ts_'));
    const escalatorDevices = devices.filter((d) => d.deviceId.startsWith('esc_'));

    if (!concourseData) return { hasConflict: false };

    const totalTurnstileThroughput = turnstileDevices.reduce((sum, d) => sum + d.throughput, 0);
    const totalEscalatorThroughput = escalatorDevices.reduce((sum, d) => sum + d.throughput, 0);

    const concourseCount = concourseData.count;
    const estimatedFromDevices = totalTurnstileThroughput * 0.7 + totalEscalatorThroughput * 0.5;

    const diff = Math.abs(concourseCount - estimatedFromDevices);
    const diffPercentage = diff / Math.max(concourseCount, estimatedFromDevices);

    if (diffPercentage > 0.15) {
      const conflictData = {
        concourse: { count: concourseCount, source: 'camera_ai' },
        turnstile: { totalThroughput: totalTurnstileThroughput, source: 'hardware_counter' },
        escalator: { totalThroughput: totalEscalatorThroughput, source: 'infrared_sensor' },
        confidence: {
          concourse: 0.85,
          turnstile: 0.92,
          escalator: 0.8,
        },
      };

      const anomaly = this.createAnomaly(
        'data_conflict',
        'medium',
        '多源数据冲突',
        'concourse_main',
        time,
        { diffPercentage: diffPercentage * 100, concourseCount, estimatedFromDevices },
        [
          this.createEvidence('concourse_camera', { count: concourseCount }, time, 0.85),
          this.createEvidence('turnstile_counter', { throughput: totalTurnstileThroughput }, time, 0.92),
          this.createEvidence('escalator_sensor', { throughput: totalEscalatorThroughput }, time, 0.8),
        ]
      );

      return { hasConflict: true, anomaly, conflictData };
    }

    return { hasConflict: false };
  }

  private createAnomaly(
    type: AnomalyType,
    severity: Severity,
    location: string,
    zoneId: string,
    startTime: string,
    peakData: Record<string, number>,
    evidence: EvidenceItem[]
  ): Anomaly {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      type,
      severity,
      location,
      zoneId,
      startTime,
      peakData,
      status: 'active',
      evidence,
    };
  }

  private createEvidence(
    source: string,
    data: object,
    timestamp: string,
    confidence: number
  ): EvidenceItem {
    return {
      source,
      data,
      timestamp: generateTimestamp(),
      confidence,
    };
  }

  private getZoneForEscalator(escalatorId: string): string {
    if (escalatorId.startsWith('esc_1')) return 'escalator_group_a';
    if (escalatorId.startsWith('esc_10')) return 'escalator_group_b';
    return 'concourse_main';
  }

  static getAnomalyTypeName(type: AnomalyType): string {
    const names: Record<AnomalyType, string> = {
      reflow: '客流回流',
      wrong_direction: '扶梯方向错误',
      over_capacity: '容量超限',
      capacity_warning: '容量预警',
      data_conflict: '数据冲突',
      escalator_stop: '扶梯停运',
    };
    return names[type] || type;
  }

  static getAnomalyColor(type: AnomalyType): string {
    const colors: Record<AnomalyType, string> = {
      reflow: '#FF3B30',
      wrong_direction: '#FF3B30',
      over_capacity: '#FF3B30',
      capacity_warning: '#FFB800',
      data_conflict: '#AF52DE',
      escalator_stop: '#FFB800',
    };
    return colors[type] || '#00D4FF';
  }

  static getSeverityName(severity: Severity): string {
    const names: Record<Severity, string> = {
      high: '高',
      medium: '中',
      low: '低',
    };
    return names[severity];
  }
}

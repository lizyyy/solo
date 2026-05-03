import dayjs from 'dayjs';
import { RiskType } from '../../types';
import type {
  SensorReading,
  FeedingEvent,
  AeratorLog,
  MortalityRecord,
  RiskEvent,
  TimelineEvent,
} from '../../types';

export interface RuleEngineConfig {
  lowDoThreshold: number;
  lowDoDurationMinutes: number;
  feedingDoDropThreshold: number;
  feedingDoDropWindowMinutes: number;
  aeratorResponseDelayMinutes: number;
  sensorDriftThreshold: number;
  sensorDriftWindowHours: number;
}

const defaultConfig: RuleEngineConfig = {
  lowDoThreshold: 4.0,
  lowDoDurationMinutes: 60,
  feedingDoDropThreshold: 1.5,
  feedingDoDropWindowMinutes: 120,
  aeratorResponseDelayMinutes: 30,
  sensorDriftThreshold: 0.5,
  sensorDriftWindowHours: 24,
};

export class RuleEngine {
  private config: RuleEngineConfig;

  constructor(config: Partial<RuleEngineConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  detectAllRisks(
    sensorReadings: SensorReading[],
    feedingEvents: FeedingEvent[],
    aeratorLogs: AeratorLog[],
    mortalityRecords: MortalityRecord[]
  ): RiskEvent[] {
    const risks: RiskEvent[] = [];

    risks.push(...this.detectLowDoSustained(sensorReadings));
    risks.push(...this.detectDoDropAfterFeeding(sensorReadings, feedingEvents));
    risks.push(...this.detectAeratorResponseDelay(sensorReadings, aeratorLogs));
    risks.push(...this.detectSensorDrift(sensorReadings));
    risks.push(...this.detectUnexplainedMortality(mortalityRecords, sensorReadings));

    return risks.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
  }

  detectLowDoSustained(readings: SensorReading[]): RiskEvent[] {
    const risks: RiskEvent[] = [];
    const pondReadings = this.groupByPond(readings);

    Object.entries(pondReadings).forEach(([pondId, pondReadingList]) => {
      const sorted = pondReadingList.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
      let lowDoStart: dayjs.Dayjs | null = null;
      let minDo = Infinity;
      let maxDo = -Infinity;

      for (let i = 0; i < sorted.length; i++) {
        const reading = sorted[i];
        
        if (reading.dissolvedOxygen < this.config.lowDoThreshold) {
          if (!lowDoStart) {
            lowDoStart = reading.timestamp;
          }
          minDo = Math.min(minDo, reading.dissolvedOxygen);
          maxDo = Math.max(maxDo, reading.dissolvedOxygen);
        } else if (lowDoStart) {
          const durationMinutes = reading.timestamp.diff(lowDoStart, 'minute');
          if (durationMinutes >= this.config.lowDoDurationMinutes) {
            risks.push(this.createLowDoRisk(
              pondId,
              lowDoStart,
              reading.timestamp,
              durationMinutes,
              minDo,
              maxDo
            ));
          }
          lowDoStart = null;
          minDo = Infinity;
          maxDo = -Infinity;
        }
      }

      if (lowDoStart && sorted.length > 0) {
        const lastReading = sorted[sorted.length - 1];
        const durationMinutes = lastReading.timestamp.diff(lowDoStart, 'minute');
        if (durationMinutes >= this.config.lowDoDurationMinutes) {
          risks.push(this.createLowDoRisk(
            pondId,
            lowDoStart,
            lastReading.timestamp,
            durationMinutes,
            minDo,
            maxDo
          ));
        }
      }
    });

    return risks;
  }

  detectDoDropAfterFeeding(
    readings: SensorReading[],
    feedings: FeedingEvent[]
  ): RiskEvent[] {
    const risks: RiskEvent[] = [];
    const pondReadings = this.groupByPond(readings);
    const pondFeedings = this.groupByPond(feedings);

    Object.entries(pondFeedings).forEach(([pondId, pondFeedingList]) => {
      const pondReadingList = pondReadings[pondId] || [];
      const sortedReadings = pondReadingList.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

      pondFeedingList.forEach(feeding => {
        const windowStart = feeding.timestamp;
        const windowEnd = feeding.timestamp.add(this.config.feedingDoDropWindowMinutes, 'minute');

        const readingsInWindow = sortedReadings.filter(
          r => r.timestamp.isAfter(windowStart) && r.timestamp.isBefore(windowEnd)
        );

        if (readingsInWindow.length < 2) return;

        const sortedWindow = readingsInWindow.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
        const firstReading = sortedWindow[0];
        let maxDrop = 0;
        let maxDropReading = firstReading;

        sortedWindow.forEach(reading => {
          const drop = firstReading.dissolvedOxygen - reading.dissolvedOxygen;
          if (drop > maxDrop) {
            maxDrop = drop;
            maxDropReading = reading;
          }
        });

        if (maxDrop >= this.config.feedingDoDropThreshold) {
          risks.push({
            id: `do_drop_${pondId}_${feeding.timestamp.valueOf()}_${maxDropReading.timestamp.valueOf()}`,
            type: RiskType.DO_DROP_AFTER_FEEDING,
            pondId,
            timestamp: maxDropReading.timestamp,
            severity: this.getDropSeverity(maxDrop),
            description: `投喂后溶氧显著下降: 投喂量 ${feeding.feedAmount}kg, 溶氧从 ${firstReading.dissolvedOxygen.toFixed(2)} mg/L 降至 ${maxDropReading.dissolvedOxygen.toFixed(2)} mg/L`,
            details: {
              feedAmount: feeding.feedAmount,
              feedType: feeding.feedType,
              feedingDuration: feeding.feedingDuration,
              initialDo: firstReading.dissolvedOxygen,
              droppedDo: maxDropReading.dissolvedOxygen,
              dropAmount: maxDrop,
              dropTimeMinutes: maxDropReading.timestamp.diff(feeding.timestamp, 'minute'),
            },
          });
        }
      });
    });

    return risks;
  }

  detectAeratorResponseDelay(
    readings: SensorReading[],
    aeratorLogs: AeratorLog[]
  ): RiskEvent[] {
    const risks: RiskEvent[] = [];
    const pondReadings = this.groupByPond(readings);
    const pondAerators = this.groupByPond(aeratorLogs);

    Object.entries(pondAerators).forEach(([pondId, pondAeratorList]) => {
      const pondReadingList = pondReadings[pondId] || [];
      const sortedReadings = pondReadingList.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
      const sortedAerators = pondAeratorList.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

      const lowDoPeriods = this.findLowDoPeriods(sortedReadings);

      lowDoPeriods.forEach(period => {
        const expectedStart = period.start;
        const nextAeratorStart = sortedAerators.find(
          log => log.action === 'start' && log.timestamp.isAfter(expectedStart)
        );

        if (nextAeratorStart) {
          const delayMinutes = nextAeratorStart.timestamp.diff(expectedStart, 'minute');
          if (delayMinutes > this.config.aeratorResponseDelayMinutes) {
            risks.push({
              id: `aerator_delay_${pondId}_${expectedStart.valueOf()}`,
              type: RiskType.AERATOR_RESPONSE_DELAY,
              pondId,
              timestamp: expectedStart,
              endTimestamp: nextAeratorStart.timestamp,
              severity: this.getDelaySeverity(delayMinutes),
              description: `增氧机响应延迟: 溶氧低阈值时间 ${expectedStart.format('YYYY-MM-DD HH:mm')}`,
              details: {
                lowDoThreshold: this.config.lowDoThreshold,
                periodStartDo: period.minDo,
                delayMinutes,
                aeratorId: nextAeratorStart.aeratorId,
                aeratorAction: nextAeratorStart.action,
              },
            });
          }
        }
      });
    });

    return risks;
  }

  detectSensorDrift(readings: SensorReading[]): RiskEvent[] {
    const risks: RiskEvent[] = [];
    const pondReadings = this.groupByPond(readings);

    Object.entries(pondReadings).forEach(([pondId, pondReadingList]) => {
      const sortedReadings = pondReadingList.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

      if (sortedReadings.length < 2) return;

      let windowSize = Math.floor(sortedReadings.length / 2);
      if (windowSize < 2) return;

      const firstHalf = sortedReadings.slice(0, windowSize);
      const secondHalf = sortedReadings.slice(windowSize);

      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.dissolvedOxygen, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.dissolvedOxygen, 0) / secondHalf.length;

      const drift = Math.abs(firstHalfAvg - secondHalfAvg);

      if (drift >= this.config.sensorDriftThreshold) {
        const firstTimeSpanHours = firstHalf[firstHalf.length - 1].timestamp.diff(
          firstHalf[0].timestamp, 'hour');
        const secondTimeSpanHours = secondHalf[secondHalf.length - 1].timestamp.diff(
          secondHalf[0].timestamp, 'hour');

        if (firstTimeSpanHours >= this.config.sensorDriftWindowHours ||
            secondTimeSpanHours >= this.config.sensorDriftWindowHours) {
          risks.push({
            id: `sensor_drift_${pondId}_${sortedReadings[0].timestamp.valueOf()}`,
            type: RiskType.SENSOR_DRIFT,
            pondId,
            timestamp: sortedReadings[0].timestamp,
            endTimestamp: sortedReadings[sortedReadings.length - 1].timestamp,
            severity: this.getDriftSeverity(drift),
            description: `传感器可能存在漂移: 前半段平均溶氧 ${firstHalfAvg.toFixed(2)} mg/L, 后半段平均溶氧 ${secondHalfAvg.toFixed(2)} mg/L, 漂移量 ${drift.toFixed(2)} mg/L`,
            details: {
              firstHalfAvg,
              secondHalfAvg,
              driftAmount: drift,
              firstHalfStartTime: firstHalf[0].timestamp.format('YYYY-MM-DD HH:mm'),
              secondHalfStartTime: secondHalf[0].timestamp.format('YYYY-MM-DD HH:mm'),
              dataPoints: sortedReadings.length,
            },
          });
        }
      }
    });

    return risks;
  }

  detectUnexplainedMortality(
    mortalityRecords: MortalityRecord[],
    readings: SensorReading[]
  ): RiskEvent[] {
    const risks: RiskEvent[] = [];
    const pondMortality = this.groupByPond(mortalityRecords);
    const pondReadings = this.groupByPond(readings);

    Object.entries(pondMortality).forEach(([pondId, pondMortalityList]) => {
      const pondReadingList = pondReadings[pondId] || [];
      const sortedReadings = pondReadingList.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

      pondMortalityList.forEach(mortality => {
        const cause = mortality.cause?.toLowerCase() || '';
        
        if (!cause || cause === 'unknown' || cause === '不明' || cause === '未明') {
          const windowStart = mortality.timestamp.subtract(24, 'hour');
          const windowEnd = mortality.timestamp.add(6, 'hour');

          const readingsInWindow = sortedReadings.filter(
            r => r.timestamp.isAfter(windowStart) && r.timestamp.isBefore(windowEnd)
          );

          const hasLowDo = readingsInWindow.some(r => r.dissolvedOxygen < this.config.lowDoThreshold);
          const minDo = readingsInWindow.length > 0 
            ? Math.min(...readingsInWindow.map(r => r.dissolvedOxygen))
            : null;

          risks.push({
            id: `mortality_${pondId}_${mortality.timestamp.valueOf()}`,
            type: RiskType.UNEXPLAINED_MORTALITY,
            pondId,
            timestamp: mortality.timestamp,
            severity: mortality.count > 10 ? 'critical' : mortality.count > 5 ? 'high' : 'medium',
            description: `不明原因死亡: 死亡数量 ${mortality.count} 尾`,
            details: {
              mortalityCount: mortality.count,
              cause: mortality.cause,
              notes: mortality.notes,
              hasPriorLowDo: hasLowDo,
              minDoInWindow: minDo,
            },
          });
        }
      });
    });

    return risks;
  }

  buildTimeline(
    sensorReadings: SensorReading[],
    feedingEvents: FeedingEvent[],
    aeratorLogs: AeratorLog[],
    mortalityRecords: MortalityRecord[],
    risks: RiskEvent[]
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    sensorReadings.forEach(reading => {
      events.push({
        id: `sensor_${reading.pondId}_${reading.timestamp.valueOf()}`,
        type: 'sensor',
        timestamp: reading.timestamp,
        pondId: reading.pondId,
        data: reading,
      });
    });

    feedingEvents.forEach(event => {
      events.push({
        id: `feeding_${event.pondId}_${event.timestamp.valueOf()}`,
        type: 'feeding',
        timestamp: event.timestamp,
        pondId: event.pondId,
        data: event,
      });
    });

    aeratorLogs.forEach(log => {
      events.push({
        id: `aerator_${log.pondId}_${log.timestamp.valueOf()}`,
        type: 'aerator',
        timestamp: log.timestamp,
        pondId: log.pondId,
        data: log,
      });
    });

    mortalityRecords.forEach(record => {
      events.push({
        id: `mortality_${record.pondId}_${record.timestamp.valueOf()}`,
        type: 'mortality',
        timestamp: record.timestamp,
        pondId: record.pondId,
        data: record,
      });
    });

    risks.forEach(risk => {
      events.push({
        id: risk.id,
        type: 'risk',
        timestamp: risk.timestamp,
        pondId: risk.pondId,
        data: risk,
        riskType: risk.type,
        severity: risk.severity,
      });
    });

    return events.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
  }

  private groupByPond<T extends { pondId: string }>(items: T[]): Record<string, T[]> {
    return items.reduce((acc, item) => {
      if (!acc[item.pondId]) {
        acc[item.pondId] = [];
      }
      acc[item.pondId].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  private findLowDoPeriods(readings: SensorReading[]): Array<{ start: dayjs.Dayjs; end: dayjs.Dayjs; minDo: number; maxDo: number }> {
    const periods: Array<{ start: dayjs.Dayjs; end: dayjs.Dayjs; minDo: number; maxDo: number }> = [];
    let inLowDo = false;
    let periodStart: dayjs.Dayjs | null = null;
    let minDo = Infinity;
    let maxDo = -Infinity;

    readings.forEach(reading => {
      if (reading.dissolvedOxygen < this.config.lowDoThreshold) {
        if (!inLowDo) {
          inLowDo = true;
          periodStart = reading.timestamp;
          minDo = Infinity;
          maxDo = -Infinity;
        }
        minDo = Math.min(minDo, reading.dissolvedOxygen);
        maxDo = Math.max(maxDo, reading.dissolvedOxygen);
      } else if (inLowDo && periodStart) {
        inLowDo = false;
        periods.push({
          start: periodStart,
          end: reading.timestamp,
          minDo,
          maxDo,
        });
        periodStart = null;
      }
    });

    if (inLowDo && periodStart && readings.length > 0) {
      const lastReading = readings[readings.length - 1];
      periods.push({
        start: periodStart,
        end: lastReading.timestamp,
        minDo,
        maxDo,
      });
    }

    return periods;
  }

  private createLowDoRisk(
    pondId: string,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    durationMinutes: number,
    minDo: number,
    maxDo: number
  ): RiskEvent {
    return {
      id: `low_do_${pondId}_${start.valueOf()}_${end.valueOf()}`,
      type: RiskType.LOW_DO_SUSTAINED,
      pondId,
      timestamp: start,
      endTimestamp: end,
      severity: this.getLowDoSeverity(durationMinutes, minDo),
      description: `低溶氧持续: 从 ${start.format('YYYY-MM-DD HH:mm')} 至 ${end.format('YYYY-MM-DD HH:mm')}, 持续 ${Math.floor(durationMinutes / 60)} 小时 ${durationMinutes % 60} 分钟`,
      details: {
        lowDoThreshold: this.config.lowDoThreshold,
        minDo,
        maxDo,
        durationMinutes,
        durationHours: durationMinutes / 60,
      },
    };
  }

  private getLowDoSeverity(durationMinutes: number, minDo: number): RiskEvent['severity'] {
    const hours = durationMinutes / 60;
    if (hours >= 8 || minDo < 2.0) return 'critical';
    if (hours >= 4 || minDo < 3.0) return 'high';
    if (hours >= 2 || minDo < 3.5) return 'medium';
    return 'low';
  }

  private getDropSeverity(dropAmount: number): RiskEvent['severity'] {
    if (dropAmount >= 3.0) return 'critical';
    if (dropAmount >= 2.0) return 'high';
    if (dropAmount >= 1.5) return 'medium';
    return 'low';
  }

  private getDelaySeverity(delayMinutes: number): RiskEvent['severity'] {
    if (delayMinutes >= 120) return 'critical';
    if (delayMinutes >= 60) return 'high';
    if (delayMinutes >= 30) return 'medium';
    return 'low';
  }

  private getDriftSeverity(drift: number): RiskEvent['severity'] {
    if (drift >= 2.0) return 'critical';
    if (drift >= 1.0) return 'high';
    if (drift >= 0.5) return 'medium';
    return 'low';
  }
}

export default RuleEngine;

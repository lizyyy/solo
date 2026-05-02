import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes } from 'date-fns';
import { TemperatureRecord, Anomaly, AnomalyType, SeverityLevel } from '../../types';
import { IRule, RuleDetectionContext, RuleResult } from '../types';

export class UnderTempRule implements IRule {
  name = '低温检测规则';
  anomalyType: AnomalyType = 'under_temp';

  detect(context: RuleDetectionContext): RuleResult {
    const { records, config, fridgeId, probeId } = context;
    const anomalies: Anomaly[] = [];
    
    const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let currentAnomalyStart: TemperatureRecord | null = null;
    let anomalyRecords: TemperatureRecord[] = [];
    const threshold = config.thresholds.underTempThreshold;

    for (const record of sorted) {
      if (!record.isValid) continue;

      const isUnderTemp = record.temperature < threshold;

      if (isUnderTemp) {
        if (!currentAnomalyStart) {
          currentAnomalyStart = record;
        }
        anomalyRecords.push(record);
      } else if (currentAnomalyStart && anomalyRecords.length > 0) {
        const duration = differenceInMinutes(record.timestamp, currentAnomalyStart.timestamp);
        
        if (duration > 0) {
          const minTemp = Math.min(...anomalyRecords.map(r => r.temperature));
          const severity = this.calculateSeverity(duration, minTemp, threshold);
          
          anomalies.push(this.createAnomaly(
            currentAnomalyStart,
            record,
            duration,
            severity,
            minTemp,
            threshold,
            fridgeId,
            probeId,
            anomalyRecords
          ));
        }
        
        currentAnomalyStart = null;
        anomalyRecords = [];
      }
    }

    if (currentAnomalyStart && anomalyRecords.length > 0) {
      const lastRecord = anomalyRecords[anomalyRecords.length - 1];
      const duration = differenceInMinutes(lastRecord.timestamp, currentAnomalyStart.timestamp);
      
      if (duration > 0) {
        const minTemp = Math.min(...anomalyRecords.map(r => r.temperature));
        const severity = this.calculateSeverity(duration, minTemp, threshold);
        
        anomalies.push(this.createAnomaly(
          currentAnomalyStart,
          lastRecord,
          duration,
          severity,
          minTemp,
          threshold,
          fridgeId,
          probeId,
          anomalyRecords
        ));
      }
    }

    return { anomalies };
  }

  private calculateSeverity(durationMinutes: number, minTemp: number, threshold: number): SeverityLevel {
    const deficit = threshold - minTemp;
    
    if (deficit > 5 || durationMinutes > 120) {
      return 'critical';
    }
    if (deficit > 2 || durationMinutes > 60) {
      return 'warning';
    }
    return 'info';
  }

  private createAnomaly(
    start: TemperatureRecord,
    end: TemperatureRecord,
    duration: number,
    severity: SeverityLevel,
    minTemp: number,
    threshold: number,
    fridgeId: string,
    probeId: string,
    records: TemperatureRecord[]
  ): Anomaly {
    return {
      id: uuidv4(),
      type: this.anomalyType,
      fridgeId,
      probeId,
      startTime: start.timestamp,
      endTime: end.timestamp,
      durationMinutes: Math.max(duration, 1),
      severity,
      description: `低温异常：最低温度 ${minTemp.toFixed(1)}°C，低于阈值 ${threshold}°C，持续 ${Math.max(duration, 1)} 分钟`,
      affectedRecords: records,
      metadata: {
        minTemperature: minTemp,
        threshold,
      },
    };
  }
}

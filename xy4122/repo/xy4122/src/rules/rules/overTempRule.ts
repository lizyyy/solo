import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes } from 'date-fns';
import { TemperatureRecord, Anomaly, AnomalyType, SeverityLevel } from '../../types';
import { IRule, RuleDetectionContext, RuleResult } from '../types';

export class OverTempRule implements IRule {
  name = '超温检测规则';
  anomalyType: AnomalyType = 'over_temp';

  detect(context: RuleDetectionContext): RuleResult {
    const { records, config, fridgeId, probeId } = context;
    const anomalies: Anomaly[] = [];
    
    const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let currentAnomalyStart: TemperatureRecord | null = null;
    let anomalyRecords: TemperatureRecord[] = [];
    const threshold = config.thresholds.overTempThreshold;

    for (const record of sorted) {
      if (!record.isValid) continue;

      const isOverTemp = record.temperature > threshold;

      if (isOverTemp) {
        if (!currentAnomalyStart) {
          currentAnomalyStart = record;
        }
        anomalyRecords.push(record);
      } else if (currentAnomalyStart && anomalyRecords.length > 0) {
        const duration = differenceInMinutes(record.timestamp, currentAnomalyStart.timestamp);
        
        if (duration > 0) {
          const maxTemp = Math.max(...anomalyRecords.map(r => r.temperature));
          const severity = this.calculateSeverity(duration, maxTemp, threshold);
          
          anomalies.push(this.createAnomaly(
            currentAnomalyStart,
            record,
            duration,
            severity,
            maxTemp,
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
        const maxTemp = Math.max(...anomalyRecords.map(r => r.temperature));
        const severity = this.calculateSeverity(duration, maxTemp, threshold);
        
        anomalies.push(this.createAnomaly(
          currentAnomalyStart,
          lastRecord,
          duration,
          severity,
          maxTemp,
          fridgeId,
          probeId,
          anomalyRecords
        ));
      }
    }

    return { anomalies };
  }

  private calculateSeverity(durationMinutes: number, maxTemp: number, threshold: number): SeverityLevel {
    const overage = maxTemp - threshold;
    
    if (overage > 5 || durationMinutes > 120) {
      return 'critical';
    }
    if (overage > 2 || durationMinutes > 60) {
      return 'warning';
    }
    return 'info';
  }

  private createAnomaly(
    start: TemperatureRecord,
    end: TemperatureRecord,
    duration: number,
    severity: SeverityLevel,
    maxTemp: number,
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
      description: `超温异常：最高温度 ${maxTemp.toFixed(1)}°C，持续 ${Math.max(duration, 1)} 分钟`,
      affectedRecords: records,
      metadata: {
        maxTemperature: maxTemp,
        threshold: this.anomalyType === 'over_temp' ? '超过上限' : '低于下限',
      },
    };
  }
}

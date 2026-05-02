import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes } from 'date-fns';
import { TemperatureRecord, Anomaly, AnomalyType, SeverityLevel } from '../../types';
import { IRule, RuleDetectionContext, RuleResult } from '../types';

export class ProbeDisconnectRule implements IRule {
  name = '探头断线检测规则';
  anomalyType: AnomalyType = 'probe_disconnect';

  detect(context: RuleDetectionContext): RuleResult {
    const { records, config, fridgeId, probeId } = context;
    const anomalies: Anomaly[] = [];
    
    const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const disconnectThreshold = config.probeDisconnectThreshold;

    let currentAnomalyStart: TemperatureRecord | null = null;
    let anomalyRecords: TemperatureRecord[] = [];

    for (const record of sorted) {
      const isDisconnect = this.isProbeDisconnect(record, disconnectThreshold);

      if (isDisconnect) {
        if (!currentAnomalyStart) {
          currentAnomalyStart = record;
        }
        anomalyRecords.push(record);
      } else if (currentAnomalyStart && anomalyRecords.length > 0) {
        const duration = differenceInMinutes(record.timestamp, currentAnomalyStart.timestamp);
        
        if (duration > 0) {
          const severity = this.calculateSeverity(duration);
          
          anomalies.push(this.createAnomaly(
            currentAnomalyStart,
            record,
            duration,
            severity,
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
        const severity = this.calculateSeverity(duration);
        
        anomalies.push(this.createAnomaly(
          currentAnomalyStart,
          lastRecord,
          duration,
          severity,
          fridgeId,
          probeId,
          anomalyRecords
        ));
      }
    }

    return { anomalies };
  }

  private isProbeDisconnect(record: TemperatureRecord, threshold: number): boolean {
    if (!record.isValid) {
      return true;
    }
    
    if (record.temperature <= threshold) {
      return true;
    }
    
    const rawLower = record.rawValue.toLowerCase().trim();
    if (rawLower === 'error' || 
        rawLower === 'disconnect' ||
        rawLower === '断线' ||
        rawLower === '故障' ||
        rawLower === 'na' ||
        rawLower === 'n/a' ||
        rawLower === '-') {
      return true;
    }
    
    return false;
  }

  private calculateSeverity(durationMinutes: number): SeverityLevel {
    if (durationMinutes > 60) {
      return 'critical';
    }
    if (durationMinutes > 30) {
      return 'warning';
    }
    return 'info';
  }

  private createAnomaly(
    start: TemperatureRecord,
    end: TemperatureRecord,
    duration: number,
    severity: SeverityLevel,
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
      description: `探头断线/故障：持续 ${Math.max(duration, 1)} 分钟，温度数据异常`,
      affectedRecords: records,
      metadata: {
        firstRecord: start.rawValue,
        lastRecord: end.rawValue,
        recordCount: records.length,
      },
    };
  }
}

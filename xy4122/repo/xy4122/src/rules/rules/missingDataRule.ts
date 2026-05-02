import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes } from 'date-fns';
import { TemperatureRecord, Anomaly, AnomalyType, SeverityLevel } from '../../types';
import { IRule, RuleDetectionContext, RuleResult } from '../types';

export class MissingDataRule implements IRule {
  name = '缺测检测规则';
  anomalyType: AnomalyType = 'missing_data';

  detect(context: RuleDetectionContext): RuleResult {
    const { records, config, fridgeId, probeId } = context;
    const anomalies: Anomaly[] = [];
    
    const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const thresholdMinutes = config.thresholds.missingDataMinutes;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      
      const gapMinutes = differenceInMinutes(current.timestamp, prev.timestamp);
      
      if (gapMinutes > thresholdMinutes) {
        const severity = this.calculateSeverity(gapMinutes);
        
        anomalies.push(this.createAnomaly(
          prev,
          current,
          gapMinutes,
          severity,
          fridgeId,
          probeId
        ));
      }
    }

    return { anomalies };
  }

  private calculateSeverity(gapMinutes: number): SeverityLevel {
    if (gapMinutes > 240) {
      return 'critical';
    }
    if (gapMinutes > 120) {
      return 'warning';
    }
    return 'info';
  }

  private createAnomaly(
    prev: TemperatureRecord,
    current: TemperatureRecord,
    gapMinutes: number,
    severity: SeverityLevel,
    fridgeId: string,
    probeId: string
  ): Anomaly {
    return {
      id: uuidv4(),
      type: this.anomalyType,
      fridgeId,
      probeId,
      startTime: prev.timestamp,
      endTime: current.timestamp,
      durationMinutes: gapMinutes,
      severity,
      description: `数据缺测：时间间隔 ${gapMinutes} 分钟，超过阈值`,
      affectedRecords: [prev, current],
      metadata: {
        gapMinutes,
        lastValidTime: prev.timestamp.toISOString(),
        nextValidTime: current.timestamp.toISOString(),
      },
    };
  }
}

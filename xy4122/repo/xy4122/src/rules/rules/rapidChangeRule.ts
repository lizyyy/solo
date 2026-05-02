import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes } from 'date-fns';
import { TemperatureRecord, Anomaly, AnomalyType, SeverityLevel } from '../../types';
import { IRule, RuleDetectionContext, RuleResult } from '../types';

export class RapidChangeRule implements IRule {
  name = '温度剧烈波动检测规则';
  anomalyType: AnomalyType = 'rapid_change';

  detect(context: RuleDetectionContext): RuleResult {
    const { records, config, fridgeId, probeId } = context;
    const anomalies: Anomaly[] = [];
    
    const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const threshold = config.thresholds.rapidChangeThreshold;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      
      if (!prev.isValid || !current.isValid) continue;
      
      const timeDiff = differenceInMinutes(current.timestamp, prev.timestamp);
      
      if (timeDiff <= 0 || timeDiff > 30) continue;
      
      const tempDiff = Math.abs(current.temperature - prev.temperature);
      
      if (tempDiff >= threshold) {
        const severity = this.calculateSeverity(tempDiff, timeDiff);
        
        anomalies.push(this.createAnomaly(
          prev,
          current,
          tempDiff,
          timeDiff,
          severity,
          fridgeId,
          probeId
        ));
      }
    }

    return { anomalies };
  }

  private calculateSeverity(tempDiff: number, timeDiff: number): SeverityLevel {
    const ratePerMinute = tempDiff / Math.max(timeDiff, 1);
    
    if (ratePerMinute > 2 || tempDiff > 5) {
      return 'critical';
    }
    if (ratePerMinute > 1 || tempDiff > 3) {
      return 'warning';
    }
    return 'info';
  }

  private createAnomaly(
    prev: TemperatureRecord,
    current: TemperatureRecord,
    tempDiff: number,
    timeDiff: number,
    severity: SeverityLevel,
    fridgeId: string,
    probeId: string
  ): Anomaly {
    const direction = current.temperature > prev.temperature ? '上升' : '下降';
    
    return {
      id: uuidv4(),
      type: this.anomalyType,
      fridgeId,
      probeId,
      startTime: prev.timestamp,
      endTime: current.timestamp,
      durationMinutes: Math.max(timeDiff, 1),
      severity,
      description: `温度剧烈波动：${direction} ${tempDiff.toFixed(1)}°C，用时 ${Math.max(timeDiff, 1)} 分钟`,
      affectedRecords: [prev, current],
      metadata: {
        previousTemp: prev.temperature,
        currentTemp: current.temperature,
        temperatureDifference: tempDiff,
        timeDifferenceMinutes: timeDiff,
        direction,
      },
    };
  }
}

import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes } from 'date-fns';
import { DoorRecord, Anomaly, AnomalyType, SeverityLevel } from '../../types';
import { IRule, RuleDetectionContext, RuleResult } from '../types';

export class DoorOpenLongRule implements IRule {
  name = '长时间开门检测规则';
  anomalyType: AnomalyType = 'door_open_long';

  detect(context: RuleDetectionContext): RuleResult {
    const { doorRecords, config, fridgeId } = context;
    const anomalies: Anomaly[] = [];
    
    const filtered = doorRecords.filter(r => r.fridgeId === fridgeId);
    const sorted = [...filtered].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const thresholdMinutes = config.thresholds.doorOpenMinutes;

    let openEvent: DoorRecord | null = null;

    for (const record of sorted) {
      if (record.eventType === 'open') {
        openEvent = record;
      } else if (record.eventType === 'close' && openEvent) {
        const duration = differenceInMinutes(record.timestamp, openEvent.timestamp);
        
        if (duration > thresholdMinutes) {
          const severity = this.calculateSeverity(duration);
          
          anomalies.push(this.createAnomaly(
            openEvent,
            record,
            duration,
            severity,
            fridgeId
          ));
        }
        
        openEvent = null;
      }
    }

    if (openEvent) {
      const now = new Date();
      const duration = differenceInMinutes(now, openEvent.timestamp);
      
      if (duration > thresholdMinutes) {
        const severity = this.calculateSeverity(duration);
        
        anomalies.push({
          id: uuidv4(),
          type: this.anomalyType,
          fridgeId,
          probeId: 'door',
          startTime: openEvent.timestamp,
          endTime: now,
          durationMinutes: duration,
          severity,
          description: `门仍未关闭：已开启 ${duration} 分钟`,
          affectedRecords: [],
          metadata: {
            operator: openEvent.operator,
            status: 'still_open',
          },
        });
      }
    }

    return { anomalies };
  }

  private calculateSeverity(durationMinutes: number): SeverityLevel {
    if (durationMinutes > 30) {
      return 'critical';
    }
    if (durationMinutes > 10) {
      return 'warning';
    }
    return 'info';
  }

  private createAnomaly(
    open: DoorRecord,
    close: DoorRecord,
    duration: number,
    severity: SeverityLevel,
    fridgeId: string
  ): Anomaly {
    return {
      id: uuidv4(),
      type: this.anomalyType,
      fridgeId,
      probeId: 'door',
      startTime: open.timestamp,
      endTime: close.timestamp,
      durationMinutes: duration,
      severity,
      description: `长时间开门：持续 ${duration} 分钟，超过阈值`,
      affectedRecords: [],
      metadata: {
        openOperator: open.operator,
        closeOperator: close.operator,
        thresholdMinutes: this.name.includes('长时间') ? '超过阈值' : '',
      },
    };
  }
}

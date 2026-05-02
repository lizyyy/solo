import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes, isWithinInterval } from 'date-fns';
import { VaccineBatch, Anomaly, AnomalyType, SeverityLevel, TemperatureRecord } from '../../types';
import { IRule, RuleDetectionContext, RuleResult, DEFAULT_CONFIG } from '../types';

export class TransferGapRule implements IRule {
  name = '转移空档检测规则';
  anomalyType: AnomalyType = 'transfer_gap';

  detect(context: RuleDetectionContext): RuleResult {
    const { vaccineBatches, config, fridgeId } = context;
    const anomalies: Anomaly[] = [];
    
    const transferBatches = vaccineBatches.filter(b => 
      b.targetFridgeId && b.exitDate
    );

    for (const batch of transferBatches) {
      if (batch.entryDate && batch.exitDate && batch.targetFridgeId) {
        const gapAnomalies = this.detectTransferGaps(
          batch,
          fridgeId,
          context.records,
          config.transferGapThresholdMinutes || DEFAULT_CONFIG.transferGapThresholdMinutes
        );
        anomalies.push(...gapAnomalies);
      }
    }

    return { anomalies };
  }

  private detectTransferGaps(
    batch: VaccineBatch,
    currentFridgeId: string,
    temperatureRecords: TemperatureRecord[],
    gapThresholdMinutes: number
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (batch.fridgeId === currentFridgeId && batch.exitDate) {
      const exitTime = batch.exitDate;
      const recordsAfterExit = temperatureRecords.filter(r => 
        r.timestamp > exitTime && r.fridgeId === currentFridgeId
      ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const lastRecordInFridge = temperatureRecords
        .filter(r => 
          isWithinInterval(r.timestamp, {
            start: batch.entryDate,
            end: exitTime
          }) && r.fridgeId === currentFridgeId
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (lastRecordInFridge) {
        const gapToExit = differenceInMinutes(exitTime, lastRecordInFridge.timestamp);
        
        if (gapToExit > gapThresholdMinutes) {
          anomalies.push(this.createAnomaly(
            lastRecordInFridge.timestamp,
            exitTime,
            gapToExit,
            currentFridgeId,
            batch.batchId,
            'exit'
          ));
        }
      }
    }

    return anomalies;
  }

  private createAnomaly(
    startTime: Date,
    endTime: Date,
    durationMinutes: number,
    fridgeId: string,
    batchId: string,
    gapType: 'exit' | 'entry'
  ): Anomaly {
    const severity = this.calculateSeverity(durationMinutes);
    const gapDescription = gapType === 'exit' ? '出库' : '入库';

    return {
      id: uuidv4(),
      type: this.anomalyType,
      fridgeId,
      probeId: 'transfer',
      startTime,
      endTime,
      durationMinutes: Math.max(durationMinutes, 1),
      severity,
      description: `疫苗转移空档：批次 ${batchId} ${gapDescription}期间温度监控空档 ${Math.max(durationMinutes, 1)} 分钟`,
      affectedRecords: [],
      metadata: {
        batchId,
        gapType,
        gapMinutes: durationMinutes,
      },
    };
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
}

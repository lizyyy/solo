import {
  TemperatureRecord,
  DoorRecord,
  VaccineBatch,
  Anomaly,
  RiskFragment,
  UnifiedTimeline,
  FridgeTimeline,
  BatchTimeline,
  BatchLocationEvent,
} from '../types';
import { ITimelineBuilder } from './types';
import { isWithinInterval, min, max } from 'date-fns';

export class TimelineBuilder implements ITimelineBuilder {
  build(
    temperatureRecords: TemperatureRecord[],
    doorRecords: DoorRecord[],
    vaccineBatches: VaccineBatch[],
    anomalies: Anomaly[],
    riskFragments: RiskFragment[]
  ): UnifiedTimeline {
    const allTimes: Date[] = [];

    temperatureRecords.forEach(r => allTimes.push(r.timestamp));
    doorRecords.forEach(r => allTimes.push(r.timestamp));
    vaccineBatches.forEach(b => {
      allTimes.push(b.entryDate);
      if (b.exitDate) allTimes.push(b.exitDate);
    });
    anomalies.forEach(a => {
      allTimes.push(a.startTime);
      allTimes.push(a.endTime);
    });

    if (allTimes.length === 0) {
      return {
        startTime: new Date(),
        endTime: new Date(),
        fridges: [],
        batches: [],
      };
    }

    const startTime = min(allTimes);
    const endTime = max(allTimes);

    const fridgeTimelines = this.buildFridgeTimelines(
      temperatureRecords,
      doorRecords,
      anomalies
    );

    const batchTimelines = this.buildBatchTimelines(
      vaccineBatches,
      temperatureRecords,
      anomalies,
      riskFragments
    );

    return {
      startTime,
      endTime,
      fridges: fridgeTimelines,
      batches: batchTimelines,
    };
  }

  private buildFridgeTimelines(
    temperatureRecords: TemperatureRecord[],
    doorRecords: DoorRecord[],
    anomalies: Anomaly[]
  ): FridgeTimeline[] {
    const fridgeIds = new Set<string>();
    temperatureRecords.forEach(r => fridgeIds.add(r.fridgeId));
    doorRecords.forEach(r => fridgeIds.add(r.fridgeId));
    anomalies.forEach(a => fridgeIds.add(a.fridgeId));

    const timelines: FridgeTimeline[] = [];

    for (const fridgeId of fridgeIds) {
      const fridgeRecords = temperatureRecords
        .filter(r => r.fridgeId === fridgeId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const fridgeDoorRecords = doorRecords
        .filter(r => r.fridgeId === fridgeId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const fridgeAnomalies = anomalies
        .filter(a => a.fridgeId === fridgeId)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      timelines.push({
        fridgeId,
        records: fridgeRecords,
        doorEvents: fridgeDoorRecords,
        anomalies: fridgeAnomalies,
      });
    }

    return timelines;
  }

  private buildBatchTimelines(
    vaccineBatches: VaccineBatch[],
    temperatureRecords: TemperatureRecord[],
    anomalies: Anomaly[],
    riskFragments: RiskFragment[]
  ): BatchTimeline[] {
    return vaccineBatches.map(batch => {
      const locationHistory = this.buildLocationHistory(batch);

      const batchRiskFragments = riskFragments.filter(r => r.batchId === batch.batchId);

      const batchAnomalyIds = new Set(batchRiskFragments.flatMap(r => r.anomalyIds));
      const relevantAnomalies = anomalies.filter(a => batchAnomalyIds.has(a.id));

      const relevantFridges = [...new Set([
        batch.fridgeId,
        ...relevantAnomalies.map(a => a.fridgeId),
      ])];

      const batchTemperatureInterval = {
        start: batch.entryDate,
        end: batch.exitDate || new Date(),
      };

      const relevantTemperatureRecords = temperatureRecords
        .filter(r => 
          relevantFridges.includes(r.fridgeId) &&
          isWithinInterval(r.timestamp, batchTemperatureInterval)
        )
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return {
        batchId: batch.batchId,
        batch,
        locationHistory,
        temperatureHistory: relevantTemperatureRecords,
        riskFragments: batchRiskFragments,
      };
    });
  }

  private buildLocationHistory(batch: VaccineBatch): BatchLocationEvent[] {
    const events: BatchLocationEvent[] = [];

    events.push({
      timestamp: batch.entryDate,
      fridgeId: batch.fridgeId,
      eventType: 'entry',
      quantity: batch.quantity,
    });

    if (batch.exitDate && batch.targetFridgeId) {
      events.push({
        timestamp: batch.exitDate,
        fridgeId: batch.fridgeId,
        eventType: 'transfer',
        quantity: batch.quantity,
      });

      events.push({
        timestamp: batch.exitDate,
        fridgeId: batch.targetFridgeId,
        eventType: 'entry',
        quantity: batch.quantity,
      });
    } else if (batch.exitDate) {
      events.push({
        timestamp: batch.exitDate,
        fridgeId: batch.fridgeId,
        eventType: 'exit',
        quantity: batch.quantity,
      });
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

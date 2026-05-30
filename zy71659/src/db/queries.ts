import { db } from './index';
import type { 
  RawSample, 
  AlignedSample, 
  OperationSegment, 
  Anomaly, 
  HistoryRecord,
  ImportBatch 
} from '../types';

export async function getBatchesByDevice(deviceId: string): Promise<ImportBatch[]> {
  return db.importBatches
    .where('deviceId')
    .equals(deviceId)
    .reverse()
    .sortBy('importedAt');
}

export async function getRawSamplesByBatch(batchId: string): Promise<RawSample[]> {
  return db.rawSamples
    .where('batchId')
    .equals(batchId)
    .sortBy('timestamp');
}

export async function getRawSamplesByDeviceAndTimeRange(
  deviceId: string,
  startTime: number,
  endTime: number
): Promise<RawSample[]> {
  return db.rawSamples
    .where('[deviceId+timestamp]')
    .between([deviceId, startTime], [deviceId, endTime])
    .sortBy('timestamp');
}

export async function getAlignedSamplesByDevice(deviceId: string): Promise<AlignedSample[]> {
  return db.alignedSamples.where('deviceId').equals(deviceId).sortBy('timestamp');
}

export async function getAlignedSamplesByDeviceAndTimeRange(
  deviceId: string,
  startTime: number,
  endTime: number
): Promise<AlignedSample[]> {
  return db.alignedSamples
    .where('deviceId')
    .equals(deviceId)
    .and(s => s.timestamp >= startTime && s.timestamp <= endTime)
    .sortBy('timestamp');
}

export async function getAlignedSamplesBySegment(segmentId: string): Promise<AlignedSample[]> {
  return db.alignedSamples
    .where('segmentId')
    .equals(segmentId)
    .sortBy('timestamp');
}

export async function getSegmentsByDevice(deviceId: string): Promise<OperationSegment[]> {
  return db.segments.where('deviceId').equals(deviceId).sortBy('startTime');
}

export async function getSegmentsByDeviceAndTimeRange(
  deviceId: string,
  startTime: number,
  endTime: number
): Promise<OperationSegment[]> {
  return db.segments
    .where('deviceId')
    .equals(deviceId)
    .and(s => s.endTime >= startTime && s.startTime <= endTime)
    .sortBy('startTime');
}

export async function getAnomaliesByDevice(deviceId: string): Promise<Anomaly[]> {
  return db.anomalies
    .where('deviceId')
    .equals(deviceId)
    .reverse()
    .sortBy('detectedAt');
}

export async function getAnomaliesByStatus(status: string): Promise<Anomaly[]> {
  return db.anomalies
    .where('status')
    .equals(status)
    .reverse()
    .sortBy('detectedAt');
}

export async function getAnomaliesByType(type: string): Promise<Anomaly[]> {
  return db.anomalies
    .where('type')
    .equals(type)
    .reverse()
    .sortBy('detectedAt');
}

export async function getHistoryByEntity(
  entityType: string,
  entityId: string
): Promise<HistoryRecord[]> {
  return db.history
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .reverse()
    .sortBy('timestamp');
}

export async function getHistoryByOperator(operator: string): Promise<HistoryRecord[]> {
  return db.history
    .where('operator')
    .equals(operator)
    .reverse()
    .sortBy('timestamp');
}

export async function getRecentHistory(limit: number = 50): Promise<HistoryRecord[]> {
  return db.history
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getRawSampleById(id: string): Promise<RawSample | undefined> {
  return db.rawSamples.get(id);
}

export async function getAlignedSampleById(id: string): Promise<AlignedSample | undefined> {
  return db.alignedSamples.get(id);
}

export async function getAnomalyById(id: string): Promise<Anomaly | undefined> {
  return db.anomalies.get(id);
}

export async function getSegmentById(id: string): Promise<OperationSegment | undefined> {
  return db.segments.get(id);
}

export async function getBatchById(id: string): Promise<ImportBatch | undefined> {
  return db.importBatches.get(id);
}

export async function countAnomaliesByStatus(): Promise<Record<string, number>> {
  const anomalies = await db.anomalies.toArray();
  return anomalies.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export async function countAnomaliesBySeverity(): Promise<Record<string, number>> {
  const anomalies = await db.anomalies.toArray();
  return anomalies.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export async function getDistinctDeviceIds(): Promise<string[]> {
  const batches = await db.importBatches.toArray();
  return [...new Set(batches.map(b => b.deviceId))];
}

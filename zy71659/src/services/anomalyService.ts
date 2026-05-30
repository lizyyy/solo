import { db } from '../db';
import type { Anomaly, AnomalyStatus, CorrectedData } from '../types';
import { createHistoryRecord } from './historyService';

export async function getAnomalies(
  filters?: {
    deviceId?: string;
    type?: string;
    severity?: string;
    status?: string;
    startTime?: number;
    endTime?: number;
  }
): Promise<Anomaly[]> {
  let query = db.anomalies.toCollection();
  
  if (filters?.deviceId) {
    query = db.anomalies.where('deviceId').equals(filters.deviceId);
  } else if (filters?.type) {
    query = db.anomalies.where('type').equals(filters.type);
  } else if (filters?.severity) {
    query = db.anomalies.where('severity').equals(filters.severity);
  } else if (filters?.status) {
    query = db.anomalies.where('status').equals(filters.status);
  }
  
  let anomalies = await query.reverse().sortBy('detectedAt');
  
  if (filters?.startTime) {
    anomalies = anomalies.filter(a => a.detectedAt >= filters.startTime!);
  }
  if (filters?.endTime) {
    anomalies = anomalies.filter(a => a.detectedAt <= filters.endTime!);
  }
  
  return anomalies;
}

export async function getAnomalyById(id: string): Promise<Anomaly | undefined> {
  return db.anomalies.get(id);
}

export async function confirmAnomaly(
  anomalyId: string,
  operator: string,
  note?: string,
  correctedData?: CorrectedData
): Promise<Anomaly> {
  return await db.transaction('rw', db.anomalies, db.alignedSamples, db.history, async () => {
    const anomaly = await db.anomalies.get(anomalyId);
    if (!anomaly) {
      throw new Error('异常不存在');
    }
    
    const beforeState = { ...anomaly };
    
    anomaly.status = 'confirmed';
    anomaly.confirmedBy = operator;
    anomaly.confirmedAt = Date.now();
    anomaly.confirmedNote = note;
    anomaly.updatedAt = Date.now();
    
    if (correctedData) {
      anomaly.correctedData = correctedData;
      
      if (correctedData.loadLevel !== undefined) {
        await db.alignedSamples
          .where('id')
          .anyOf(anomaly.affectedSampleIds)
          .modify({ loadLevel: correctedData.loadLevel });
      }
    }
    
    await db.anomalies.put(anomaly);
    
    await createHistoryRecord(
      'anomaly',
      anomalyId,
      'confirmed',
      operator,
      beforeState,
      anomaly,
      note
    );
    
    return anomaly;
  });
}

export async function dismissAnomaly(
  anomalyId: string,
  operator: string,
  note: string
): Promise<Anomaly> {
  return await db.transaction('rw', db.anomalies, db.history, async () => {
    const anomaly = await db.anomalies.get(anomalyId);
    if (!anomaly) {
      throw new Error('异常不存在');
    }
    
    const beforeState = { ...anomaly };
    
    anomaly.status = 'dismissed';
    anomaly.confirmedBy = operator;
    anomaly.confirmedAt = Date.now();
    anomaly.confirmedNote = note;
    anomaly.updatedAt = Date.now();
    
    await db.anomalies.put(anomaly);
    
    await createHistoryRecord(
      'anomaly',
      anomalyId,
      'dismissed',
      operator,
      beforeState,
      anomaly,
      note
    );
    
    return anomaly;
  });
}

export async function resolveAnomaly(
  anomalyId: string,
  operator: string,
  note?: string,
  correctedData?: CorrectedData
): Promise<Anomaly> {
  return await db.transaction('rw', db.anomalies, db.alignedSamples, db.history, async () => {
    const anomaly = await db.anomalies.get(anomalyId);
    if (!anomaly) {
      throw new Error('异常不存在');
    }
    
    const beforeState = { ...anomaly };
    
    anomaly.status = 'resolved';
    anomaly.confirmedBy = operator;
    anomaly.confirmedAt = Date.now();
    anomaly.confirmedNote = note;
    anomaly.updatedAt = Date.now();
    
    if (correctedData) {
      anomaly.correctedData = correctedData;
      
      if (correctedData.loadLevel !== undefined) {
        await db.alignedSamples
          .where('id')
          .anyOf(anomaly.affectedSampleIds)
          .modify({ loadLevel: correctedData.loadLevel });
      }
    }
    
    await db.anomalies.put(anomaly);
    
    await createHistoryRecord(
      'anomaly',
      anomalyId,
      'corrected',
      operator,
      beforeState,
      anomaly,
      note
    );
    
    return anomaly;
  });
}

export async function updateAnomalyStatus(
  anomalyId: string,
  status: AnomalyStatus,
  operator: string,
  note?: string
): Promise<Anomaly> {
  return await db.transaction('rw', db.anomalies, db.history, async () => {
    const anomaly = await db.anomalies.get(anomalyId);
    if (!anomaly) {
      throw new Error('异常不存在');
    }
    
    const beforeState = { ...anomaly };
    
    anomaly.status = status;
    anomaly.updatedAt = Date.now();
    
    if (status !== 'detected') {
      anomaly.confirmedBy = operator;
      anomaly.confirmedAt = Date.now();
      anomaly.confirmedNote = note;
    }
    
    await db.anomalies.put(anomaly);
    
    await createHistoryRecord(
      'anomaly',
      anomalyId,
      'updated',
      operator,
      beforeState,
      anomaly,
      note
    );
    
    return anomaly;
  });
}

export async function getAnomalyCounts(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}> {
  const anomalies = await db.anomalies.toArray();
  
  const byStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  
  for (const a of anomalies) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    byType[a.type] = (byType[a.type] || 0) + 1;
  }
  
  return {
    total: anomalies.length,
    byStatus,
    bySeverity,
    byType
  };
}

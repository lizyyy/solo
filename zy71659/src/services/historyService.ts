import { db } from '../db';
import type { HistoryRecord, EntityType, HistoryAction } from '../types';

export async function createHistoryRecord(
  entityType: EntityType,
  entityId: string,
  action: HistoryAction,
  operator: string,
  beforeState: unknown,
  afterState: unknown,
  comment?: string
): Promise<string> {
  const record: HistoryRecord = {
    entityType,
    entityId,
    action,
    operator,
    timestamp: Date.now(),
    beforeState,
    afterState,
    comment
  };
  
  const id = await db.history.add(record as HistoryRecord);
  return String(id);
}

export async function getHistoryByEntity(
  entityType: EntityType,
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

export async function getHistoryById(id: string): Promise<HistoryRecord | undefined> {
  return db.history.get(id);
}

import { HistoryRecord } from '../types';
import { historyStorage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

export function recordHistory(
  entityType: HistoryRecord['entityType'],
  entityId: string,
  action: HistoryRecord['action'],
  description: string,
  beforeData?: any,
  afterData?: any,
  operator: string = '系统管理员'
): HistoryRecord {
  const record: HistoryRecord = {
    id: uuidv4(),
    entityType,
    entityId,
    action,
    beforeData,
    afterData,
    operator,
    timestamp: new Date().toISOString(),
    description,
  };
  
  const allRecords = historyStorage.getAll();
  allRecords.push(record);
  historyStorage.save(allRecords);
  
  return record;
}

export function formatHistoryChange(before: any, after: any): string[] {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  for (const key of allKeys) {
    const beforeVal = JSON.stringify(before?.[key]);
    const afterVal = JSON.stringify(after?.[key]);
    if (beforeVal !== afterVal) {
      changes.push(`${key}: ${beforeVal || '(空)'} → ${afterVal || '(空)'}`);
    }
  }
  
  return changes;
}

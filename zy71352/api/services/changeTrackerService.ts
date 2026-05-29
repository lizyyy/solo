import { nanoid } from 'nanoid';
import type { ChangeLog } from '../../shared/types.js';
import { getDb } from '../db/index.js';

interface TrackChangeParams {
  recordId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  operator: string;
  reason?: string;
}

export const trackChange = async (params: TrackChangeParams): Promise<ChangeLog> => {
  const { recordId, fieldName, oldValue, newValue, operator, reason } = params;

  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
    return null as unknown as ChangeLog;
  }

  const db = await getDb();

  const changeLog: ChangeLog = {
    id: `log-${nanoid(8)}`,
    recordId,
    fieldName,
    oldValue,
    newValue,
    operator,
    timestamp: new Date().toISOString(),
    reason,
  };

  db.data.changeLogs.unshift(changeLog);
  await db.write();

  return changeLog;
};

export const getChangeLogsByRecordId = async (recordId: string): Promise<ChangeLog[]> => {
  const db = await getDb();
  return db.data.changeLogs.filter(log => log.recordId === recordId);
};

export const getAllChangeLogs = async (limit: number = 100): Promise<ChangeLog[]> => {
  const db = await getDb();
  return db.data.changeLogs.slice(0, limit);
};

export const trackBatchChanges = async (
  recordId: string,
  changes: Array<Omit<TrackChangeParams, 'recordId' | 'operator'> & { operator: string }>
): Promise<ChangeLog[]> => {
  const results: ChangeLog[] = [];

  for (const change of changes) {
    const result = await trackChange({
      recordId,
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      operator: change.operator,
      reason: change.reason,
    });
    if (result) {
      results.push(result);
    }
  }

  return results;
};

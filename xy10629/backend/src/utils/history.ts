import { run, get, all } from '../database';

export interface HistoryRecord {
  id?: number;
  table_name: string;
  record_id: number;
  field_name: string;
  old_value?: string;
  new_value?: string;
  modified_by: string;
  modified_at?: string;
}

export const recordModification = async (
  tableName: string,
  recordId: number,
  fieldName: string,
  oldValue: any,
  newValue: any,
  modifiedBy: string
): Promise<void> => {
  await run(
    'INSERT INTO modification_history (table_name, record_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?)',
    [
      tableName,
      recordId,
      fieldName,
      oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
      newValue !== undefined && newValue !== null ? String(newValue) : null,
      modifiedBy
    ]
  );
};

export const getModificationHistory = async (
  tableName: string,
  recordId: number
): Promise<HistoryRecord[]> => {
  return await all(
    'SELECT * FROM modification_history WHERE table_name = ? AND record_id = ? ORDER BY modified_at DESC',
    [tableName, recordId]
  );
};

export const compareAndRecordChanges = async <T extends Record<string, any>>(
  tableName: string,
  recordId: number,
  oldData: T,
  newData: Partial<T>,
  modifiedBy: string
): Promise<void> => {
  for (const key of Object.keys(newData)) {
    const oldValue = oldData[key];
    const newValue = newData[key];
    if (oldValue !== newValue && newValue !== undefined) {
      await recordModification(
        tableName,
        recordId,
        key,
        oldValue,
        newValue,
        modifiedBy
      );
    }
  }
};

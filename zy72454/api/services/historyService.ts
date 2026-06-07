import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';
import { HistoryRecord, ChangeType } from '../../shared/types.js';

export const recordChange = (
  breakpointId: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy: string,
  changeType: ChangeType,
  snapshot: Record<string, unknown>
): string => {
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO history_records 
    (id, breakpoint_id, field_name, old_value, new_value, changed_by, changed_at, change_type, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    breakpointId,
    fieldName,
    oldValue,
    newValue,
    changedBy,
    now,
    changeType,
    JSON.stringify(snapshot)
  );

  return id;
};

export const getBreakpointHistory = (breakpointId: string): HistoryRecord[] => {
  const rows = db
    .prepare(
      `SELECT * FROM history_records WHERE breakpoint_id = ? ORDER BY changed_at DESC`
    )
    .all(breakpointId) as Array<{
    id: string;
    breakpoint_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    changed_at: string;
    change_type: ChangeType;
    snapshot: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    breakpointId: row.breakpoint_id,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    changeType: row.change_type,
    snapshot: JSON.parse(row.snapshot),
  }));
};

export const getAllHistory = (limit: number = 100): HistoryRecord[] => {
  const rows = db
    .prepare(
      `SELECT * FROM history_records ORDER BY changed_at DESC LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    breakpoint_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    changed_at: string;
    change_type: ChangeType;
    snapshot: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    breakpointId: row.breakpoint_id,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    changeType: row.change_type,
    snapshot: JSON.parse(row.snapshot),
  }));
};

export const rollbackToHistory = (
  historyId: string,
  rollbackBy: string
): boolean => {
  const historyRow = db
    .prepare(`SELECT * FROM history_records WHERE id = ?`)
    .get(historyId) as
    | {
        id: string;
        breakpoint_id: string;
        field_name: string;
        old_value: string | null;
        snapshot: string;
      }
    | undefined;

  if (!historyRow) return false;

  const snapshot = JSON.parse(historyRow.snapshot);
  const beforeState = snapshot.before as Record<string, unknown>;

  if (!beforeState) return false;

  const currentRow = db
    .prepare(`SELECT * FROM breakpoints WHERE id = ?`)
    .get(historyRow.breakpoint_id) as
    | {
        id: string;
        redline_note: string | null;
        status: string;
        has_construction_detour: number;
      }
    | undefined;

  if (!currentRow) return false;

  const fieldName = historyRow.field_name;
  const oldValue = historyRow.old_value;

  let updateField = '';
  let updateValue: unknown = null;

  if (fieldName === 'redline_note') {
    updateField = 'redline_note';
    updateValue = oldValue;
  } else if (fieldName === 'status') {
    updateField = 'status';
    updateValue = oldValue;
  } else if (fieldName === 'has_construction_detour') {
    updateField = 'has_construction_detour';
    updateValue = oldValue ? parseInt(oldValue, 10) : 0;
  }

  if (!updateField) return false;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE breakpoints SET ${updateField} = ?, updated_at = ? WHERE id = ?`
  ).run(updateValue, now, historyRow.breakpoint_id);

  recordChange(
    historyRow.breakpoint_id,
    fieldName,
    (currentRow as Record<string, unknown>)[fieldName.replace(/_/g, '_')] as string | null,
    oldValue,
    rollbackBy,
    'update',
    {
      rollbackFrom: historyId,
      before: { [fieldName]: (currentRow as Record<string, unknown>)[fieldName] },
      after: { [fieldName]: oldValue },
    }
  );

  return true;
};

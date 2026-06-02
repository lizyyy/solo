import db from '../db';
import type { VersionHistory } from '../../shared/types';

function generateId(): string {
  return 'ver_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function rowToVersion(row: any): VersionHistory {
  return {
    id: row.id,
    recordId: row.record_id,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    modifiedBy: row.modified_by,
    modifiedAt: row.modified_at,
  };
}

export function findByRecordId(recordId: string): VersionHistory[] {
  const rows = db
    .prepare('SELECT * FROM version_history WHERE record_id = ? ORDER BY modified_at DESC')
    .all(recordId) as any[];
  return rows.map(rowToVersion);
}

export function create(
  recordId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  modifiedBy: string
): VersionHistory {
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO version_history (id, record_id, field_name, old_value, new_value, modified_by, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, recordId, fieldName, oldValue, newValue, modifiedBy, now);

  return {
    id,
    recordId,
    fieldName,
    oldValue,
    newValue,
    modifiedBy,
    modifiedAt: now,
  };
}

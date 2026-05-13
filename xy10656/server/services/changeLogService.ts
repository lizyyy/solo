import db from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface ChangeLog {
  id: string;
  recordType: string;
  recordId: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string;
  changeReason?: string;
  createdAt: string;
}

export function logChange(
  recordType: string,
  recordId: string,
  fieldName: string,
  oldValue: any,
  newValue: any,
  changedBy?: string,
  changeReason?: string
) {
  const stmt = db.prepare(`
    INSERT INTO change_logs (id, recordType, recordId, fieldName, oldValue, newValue, changedBy, changeReason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    uuidv4(),
    recordType,
    recordId,
    fieldName,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    changedBy,
    changeReason
  );
}

export function getChangeLogs(recordType?: string, recordId?: string) {
  let query = 'SELECT * FROM change_logs WHERE 1=1';
  const params: any[] = [];

  if (recordType) {
    query += ' AND recordType = ?';
    params.push(recordType);
  }

  if (recordId) {
    query += ' AND recordId = ?';
    params.push(recordId);
  }

  query += ' ORDER BY createdAt DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as ChangeLog[];
}

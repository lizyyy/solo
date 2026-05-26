import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { TraceRecord } from '../types';

export async function addTraceLog(
  batchId: string,
  fieldName: string,
  source: TraceRecord['source'],
  value: string,
  operator?: string,
  remark?: string,
  trainingId?: string,
  employeeId?: string
): Promise<string> {
  const db = getDatabase();
  const traceId = uuidv4();
  const timestamp = new Date().toISOString();

  await db.run(
    `INSERT INTO trace_logs (trace_id, batch_id, training_id, employee_id, field_name, source, value, timestamp, operator, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    traceId, batchId, trainingId || null, employeeId || null, fieldName, source, value, timestamp, operator || null, remark || null
  );

  return traceId;
}

export async function getTraceLogs(batchId: string, trainingId?: string, employeeId?: string): Promise<TraceRecord[]> {
  const db = getDatabase();
  let query = 'SELECT * FROM trace_logs WHERE batch_id = ?';
  const params: any[] = [batchId];

  if (trainingId) {
    query += ' AND training_id = ?';
    params.push(trainingId);
  }
  if (employeeId) {
    query += ' AND employee_id = ?';
    params.push(employeeId);
  }

  query += ' ORDER BY timestamp ASC';

  const rows = await db.all(query, params);
  return rows.map(row => ({
    traceId: row.trace_id,
    batchId: row.batch_id,
    fieldName: row.field_name,
    source: row.source as TraceRecord['source'],
    value: row.value,
    timestamp: row.timestamp,
    operator: row.operator || undefined,
    remark: row.remark || undefined,
  }));
}

import { getDB } from '../db';

export interface HistoryLog {
  id?: number;
  entity_type: string;
  entity_id: number;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  performed_by: string;
  comment?: string;
  created_at?: string;
}

export async function logHistory(log: Omit<HistoryLog, 'id' | 'created_at'>): Promise<number> {
  const db = await getDB();
  const result = await db.run(
    `INSERT INTO history_logs (entity_type, entity_id, action, field_name, old_value, new_value, performed_by, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    log.entity_type, log.entity_id, log.action, log.field_name, log.old_value, log.new_value, log.performed_by, log.comment
  );
  return result.lastID!;
}

export async function getHistoryByEntity(entityType: string, entityId: number): Promise<HistoryLog[]> {
  const db = await getDB();
  return db.all<HistoryLog[]>(
    'SELECT * FROM history_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    entityType, entityId
  );
}

export async function getAllHistory(): Promise<HistoryLog[]> {
  const db = await getDB();
  return db.all<HistoryLog[]>('SELECT * FROM history_logs ORDER BY created_at DESC');
}

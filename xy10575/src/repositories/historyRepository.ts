import { db } from '../database';
import { HistoryRecord } from '../models';

export class HistoryRepository {
  async create(data: Omit<HistoryRecord, 'id'>): Promise<HistoryRecord> {
    const id = db.generateId();
    await db.run(
      `INSERT INTO history_record
       (id, entity_type, entity_id, action, from_status, to_status, 
        changes, operator_id, operator_name, reason, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entityType, data.entityId, data.action, data.fromStatus, data.toStatus,
       data.changes, data.operatorId, data.operatorName, data.reason, data.timestamp]
    );
    return { ...data, id };
  }

  async findByEntity(entityType: string, entityId: string): Promise<HistoryRecord[]> {
    return db.all<HistoryRecord>(
      `SELECT id, entity_type as entityType, entity_id as entityId,
              action, from_status as fromStatus, to_status as toStatus,
              changes, operator_id as operatorId, operator_name as operatorName,
              reason, timestamp
       FROM history_record 
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY timestamp ASC`,
      [entityType, entityId]
    );
  }

  async findAll(filters?: { entityType?: string }): Promise<HistoryRecord[]> {
    let sql = `SELECT id, entity_type as entityType, entity_id as entityId,
                      action, from_status as fromStatus, to_status as toStatus,
                      changes, operator_id as operatorId, operator_name as operatorName,
                      reason, timestamp
               FROM history_record WHERE 1=1`;
    const params: any[] = [];
    
    if (filters?.entityType) {
      sql += ' AND entity_type = ?';
      params.push(filters.entityType);
    }
    sql += ' ORDER BY timestamp DESC';
    
    return db.all<HistoryRecord>(sql, params);
  }
}

export const historyRepository = new HistoryRepository();

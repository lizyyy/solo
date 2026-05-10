import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { EntityType, HistoryRecord } from '../types';

export const createHistoryRecord = (
  entityType: EntityType,
  entityId: string,
  action: string,
  description: string,
  operator: string,
  beforeState?: Record<string, any>,
  afterState?: Record<string, any>,
  ipAddress?: string
): HistoryRecord => {
  const record: HistoryRecord = {
    id: uuidv4(),
    entityType,
    entityId,
    action,
    description,
    beforeState,
    afterState,
    operator,
    operationTime: new Date().toISOString(),
    ipAddress
  };

  const stmt = db.prepare(`
    INSERT INTO history_records (id, entity_type, entity_id, action, description, before_state, after_state, operator, operation_time, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.entityType,
    record.entityId,
    record.action,
    record.description,
    beforeState ? JSON.stringify(beforeState) : null,
    afterState ? JSON.stringify(afterState) : null,
    record.operator,
    record.operationTime,
    record.ipAddress || null
  );

  return record;
};

export const getHistoryByEntity = (
  entityType: EntityType,
  entityId: string
): HistoryRecord[] => {
  const stmt = db.prepare(`
    SELECT * FROM history_records
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY operation_time DESC
  `);

  const rows = stmt.all(entityType, entityId) as any[];
  return rows.map(mapToHistoryRecord);
};

export const getAllHistory = (
  entityType?: EntityType,
  startTime?: string,
  endTime?: string,
  operator?: string,
  page: number = 1,
  pageSize: number = 20
): { items: HistoryRecord[], total: number } => {
  let query = `
    SELECT * FROM history_records
    WHERE 1=1
  `;
  const params: any[] = [];

  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (startTime) {
    query += ' AND operation_time >= ?';
    params.push(startTime);
  }

  if (endTime) {
    query += ' AND operation_time <= ?';
    params.push(endTime);
  }

  if (operator) {
    query += ' AND operator LIKE ?';
    params.push(`%${operator}%`);
  }

  const countStmt = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total'));
  const countResult = countStmt.get(...params) as { total: number };
  const total = countResult.total;

  query += ' ORDER BY operation_time DESC LIMIT ? OFFSET ?';
  params.push(pageSize, (page - 1) * pageSize);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];

  return {
    items: rows.map(mapToHistoryRecord),
    total
  };
};

const mapToHistoryRecord = (row: any): HistoryRecord => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  action: row.action,
  description: row.description,
  beforeState: row.before_state ? JSON.parse(row.before_state) : undefined,
  afterState: row.after_state ? JSON.parse(row.after_state) : undefined,
  operator: row.operator,
  operationTime: row.operation_time,
  ipAddress: row.ip_address
});

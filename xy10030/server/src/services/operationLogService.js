import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';

export function logOperation(params) {
  const { entityType, entityId, action, operator = 'system', oldData = null, newData = null, reason = null, requestId = null, status = 'success' } = params;
  
  const stmt = db.prepare(`
    INSERT INTO operation_logs (id, entity_type, entity_id, action, operator, old_data, new_data, reason, request_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    uuidv4(),
    entityType,
    entityId,
    action,
    operator,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
    reason,
    requestId,
    status
  );
}

export function getOperationLogs(filters = {}) {
  const { entityType, entityId, action, status, limit = 100, offset = 0 } = filters;
  
  let whereClause = [];
  let params = [];
  
  if (entityType) {
    whereClause.push('entity_type = ?');
    params.push(entityType);
  }
  if (entityId) {
    whereClause.push('entity_id = ?');
    params.push(entityId);
  }
  if (action) {
    whereClause.push('action = ?');
    params.push(action);
  }
  if (status) {
    whereClause.push('status = ?');
    params.push(status);
  }
  
  const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
  
  const logs = db.prepare(`
    SELECT id, entity_type, entity_id, action, operator, old_data, new_data, reason, request_id, status, created_at
    FROM operation_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM operation_logs
    ${where}
  `).get(...params);
  
  return {
    logs: logs.map(log => ({
      ...log,
      old_data: log.old_data ? JSON.parse(log.old_data) : null,
      new_data: log.new_data ? JSON.parse(log.new_data) : null
    })),
    total: total.count
  };
}

export function getEntityHistory(entityType, entityId) {
  return getOperationLogs({ entityType, entityId });
}

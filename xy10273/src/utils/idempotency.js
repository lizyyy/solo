const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const { now } = require('./status');

const checkIdempotency = async (entityType, operationType, requestId, entityId = null) => {
  if (!requestId) {
    return { isDuplicate: false };
  }

  const sql = `SELECT * FROM operation_logs 
               WHERE request_id = ? AND entity_type = ? AND operation_type = ?
               ${entityId ? 'AND entity_id = ?' : ''}
               ORDER BY created_at DESC LIMIT 1`;
  
  const params = entityId ? [requestId, entityType, operationType, entityId] : [requestId, entityType, operationType];
  const log = await get(sql, params);
  
  if (log) {
    return { isDuplicate: true, existingLog: log };
  }
  
  return { isDuplicate: false };
};

const logOperation = async (entityType, entityId, operationType, requestId, operator, oldStatus = null, newStatus = null, details = null) => {
  const logId = uuidv4();
  const sql = `INSERT INTO operation_logs 
               (id, entity_type, entity_id, operation_type, request_id, old_status, new_status, operator, details, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await run(sql, [
    logId,
    entityType,
    entityId,
    operationType,
    requestId,
    oldStatus,
    newStatus,
    operator,
    details ? JSON.stringify(details) : null,
    now()
  ]);
  
  return logId;
};

const getOperationHistory = async (entityType, entityId) => {
  const sql = `SELECT * FROM operation_logs 
               WHERE entity_type = ? AND entity_id = ? 
               ORDER BY created_at DESC`;
  return await all(sql, [entityType, entityId]);
};

module.exports = {
  checkIdempotency,
  logOperation,
  getOperationHistory
};

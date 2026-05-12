const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../database');
const config = require('../config');

async function createAuditLog(operation, entityType, entityId, oldValue, newValue, operator, requestId = null) {
  const now = dayjs().toISOString();
  const operatorInfo = config.operators.find(o => o.id === operator) || { id: operator, name: operator };
  
  await db.run(`
    INSERT INTO audit_logs (id, operation, entity_type, entity_id, old_value, new_value, operator_id, operator_name, request_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    uuidv4(),
    operation,
    entityType,
    entityId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    operatorInfo.id,
    operatorInfo.name,
    requestId,
    now
  ]);
}

function getOperator(operatorId) {
  return config.operators.find(o => o.id === operatorId) || { id: operatorId, name: operatorId };
}

module.exports = {
  createAuditLog,
  getOperator,
  uuidv4,
  dayjs
};

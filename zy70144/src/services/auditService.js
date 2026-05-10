const { v4: uuidv4 } = require('uuid');
const { table, insert } = require('../config/database');

function logAction(entityType, entityId, action, actor, details) {
  insert('audit_logs', {
    id: uuidv4(),
    entity_type: entityType,
    entity_id: entityId,
    action,
    actor: actor || 'system',
    details: details ? JSON.stringify(details) : null,
    created_at: new Date().toISOString()
  });
}

function getAuditLog(entityType, entityId, limit = 100) {
  const logs = table('audit_logs')
    .where('entity_type', '=', entityType)
    .where('entity_id', '=', entityId)
    .orderBy('created_at', 'DESC')
    .limit(limit)
    .all();
  
  return logs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : null
  }));
}

module.exports = {
  logAction,
  getAuditLog
};

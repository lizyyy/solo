const { getDatabase } = require('../database/init');
const { generateId } = require('./idGenerator');

function logAudit(action, module, operator, options = {}) {
  const db = getDatabase();
  const {
    targetId = null,
    targetType = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    remark = null
  } = options;

  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      id, action, module, target_id, target_type, operator, 
      old_values, new_values, ip_address, user_agent, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generateId(),
    action,
    module,
    targetId,
    targetType,
    operator,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    ipAddress,
    userAgent,
    remark
  );
}

function createAuditLog(req, action, module, options = {}) {
  return logAudit(action, module, req.headers['x-operator'] || 'system', {
    ...options,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
}

module.exports = {
  logAudit,
  createAuditLog
};

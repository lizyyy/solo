const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');

const logOperation = (operationType, entityType, entityId, oldValue, newValue, operatedBy, namespace, ipAddress, userAgent) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = Date.now();
    
    db.run(
      `INSERT INTO audit_logs (id, operation_type, entity_type, entity_id, old_value, new_value, operated_by, operated_at, namespace, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, operationType, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, operatedBy, now, namespace, ipAddress, userAgent],
      (err) => {
        if (err) reject(err);
        else resolve(id);
      }
    );
  });
};

const getAuditLogs = (namespace, entityType, entityId, limit = 100, offset = 0) => {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM audit_logs WHERE namespace = ?`;
    const params = [namespace];
    
    if (entityType) {
      query += ` AND entity_type = ?`;
      params.push(entityType);
    }
    
    if (entityId) {
      query += ` AND entity_id = ?`;
      params.push(entityId);
    }
    
    query += ` ORDER BY operated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => ({
        ...row,
        old_value: row.old_value ? JSON.parse(row.old_value) : null,
        new_value: row.new_value ? JSON.parse(row.new_value) : null
      })));
    });
  });
};

const verifyConsistency = (entityType, entityId, currentState) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY operated_at ASC`,
      [entityType, entityId],
      (err, logs) => {
        if (err) reject(err);
        
        if (logs.length === 0) {
          resolve({ consistent: true, message: '无审计日志' });
          return;
        }
        
        let reconstructed = null;
        for (const log of logs) {
          if (log.operation_type === 'CREATE') {
            reconstructed = log.new_value ? JSON.parse(log.new_value) : {};
          } else if (log.operation_type === 'UPDATE') {
            const newValue = log.new_value ? JSON.parse(log.new_value) : {};
            reconstructed = { ...reconstructed, ...newValue };
          }
        }
        
        const currentStr = JSON.stringify(Object.keys(currentState).sort().reduce((o, k) => ({ ...o, [k]: currentState[k] }), {}));
        const reconstructedStr = JSON.stringify(Object.keys(reconstructed || {}).sort().reduce((o, k) => ({ ...o, [k]: reconstructed[k] }), {}));
        
        resolve({
          consistent: currentStr === reconstructedStr,
          currentState,
          reconstructedState: reconstructed,
          logs: logs.length
        });
      }
    );
  });
};

module.exports = {
  logOperation,
  getAuditLogs,
  verifyConsistency
};

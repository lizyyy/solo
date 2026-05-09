const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../models/database');

class HistoryService {
  static recordSampleHistory(sampleId, operation, oldData, newData, operator = null, reason = null) {
    const db = getDatabase();
    db.addHistory({
      history_id: uuidv4(),
      sample_id: sampleId,
      operation,
      old_data: oldData ? JSON.stringify(oldData) : null,
      new_data: newData ? JSON.stringify(newData) : null,
      operator,
      reason,
      created_at: new Date().toISOString()
    });
  }

  static recordAudit(action, entityType, entityId, details = null, operator = null) {
    const db = getDatabase();
    db.addAuditLog({
      id: uuidv4(),
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ? JSON.stringify(details) : null,
      operator,
      created_at: new Date().toISOString()
    });
  }

  static getSampleHistory(sampleId) {
    const db = getDatabase();
    return db.findHistory(h => h.sample_id === sampleId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(row => ({
        ...row,
        old_data: row.old_data ? JSON.parse(row.old_data) : null,
        new_data: row.new_data ? JSON.parse(row.new_data) : null
      }));
  }

  static getAuditLogs(entityType = null, entityId = null, limit = 100) {
    const db = getDatabase();
    let logs = db.getSamples().length > 0 || db.data.auditLogs.length > 0 
      ? db.data.auditLogs : [];
    
    logs = db.filterAuditLogs(() => true);
    
    if (entityType) {
      logs = logs.filter(l => l.entity_type === entityType);
    }
    if (entityId) {
      logs = logs.filter(l => l.entity_id === entityId);
    }
    
    return logs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
      }));
  }
}

module.exports = HistoryService;

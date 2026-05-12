const { storage, save } = require('../utils/storage');

async function log(params) {
  const logEntry = {
    auditId: params.auditId || `AUD_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    before: params.before,
    after: params.after,
    operator: params.operator || 'system',
    description: params.description,
    timestamp: new Date().toISOString(),
    diff: calculateDiff(params.before, params.after)
  };
  
  storage.auditLogs.push(logEntry);
  await save();
  
  return logEntry;
}

function calculateDiff(before, after) {
  if (!before || !after) return null;
  
  const diff = {};
  
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  for (const key of keys) {
    const beforeVal = JSON.stringify(before[key]);
    const afterVal = JSON.stringify(after[key]);
    
    if (beforeVal !== afterVal) {
      diff[key] = {
        before: before[key],
        after: after[key]
      };
    }
  }
  
  return Object.keys(diff).length > 0 ? diff : null;
}

async function getAuditLogs(filters = {}) {
  let logs = [...storage.auditLogs];
  
  if (filters.entityType) {
    logs = logs.filter(l => l.entityType === filters.entityType);
  }
  if (filters.entityId) {
    logs = logs.filter(l => l.entityId === filters.entityId);
  }
  if (filters.action) {
    logs = logs.filter(l => l.action === filters.action);
  }
  if (filters.operator) {
    logs = logs.filter(l => l.operator === filters.operator);
  }
  if (filters.startTime) {
    logs = logs.filter(l => l.timestamp >= filters.startTime);
  }
  if (filters.endTime) {
    logs = logs.filter(l => l.timestamp <= filters.endTime);
  }
  
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function getEntityTimeline(entityType, entityId) {
  return getAuditLogs({ entityType, entityId });
}

async function logManualAdjustment(params) {
  return log({
    entityType: params.entityType,
    entityId: params.entityId,
    action: 'MANUAL_ADJUST',
    before: params.before,
    after: params.after,
    operator: params.operator,
    description: `人工修正: ${params.reason}`
  });
}

module.exports = {
  log,
  getAuditLogs,
  getEntityTimeline,
  logManualAdjustment,
  calculateDiff
};
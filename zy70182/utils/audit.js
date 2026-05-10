const { table, generateId, now } = require('./db');

function logAction(entityType, entityId, action, previousState, newState, operator, reason) {
  const logs = table('audit_logs');
  const logId = generateId();
  
  logs.insert({
    id: logId,
    entity_type: entityType,
    entity_id: entityId,
    action: action,
    previous_state: previousState ? JSON.stringify(previousState) : null,
    new_state: newState ? JSON.stringify(newState) : null,
    operator: operator || 'system',
    reason: reason || '',
    created_at: now()
  });
  
  return logId;
}

function getHistory(entityType, entityId, limit = 50) {
  const logs = table('audit_logs');
  const allLogs = logs.findAll({ 
    entity_type: entityType, 
    entity_id: entityId 
  });
  
  const sorted = allLogs.sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  
  return sorted.slice(0, limit).map(log => ({
    ...log,
    previous_state: log.previous_state ? JSON.parse(log.previous_state) : null,
    new_state: log.new_state ? JSON.parse(log.new_state) : null
  }));
}

function getRecentActions(days = 7) {
  const logs = table('audit_logs');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const recent = logs._data.filter(log => 
    new Date(log.created_at) > since
  );
  
  return recent.sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  ).slice(0, 100);
}

module.exports = {
  logAction,
  getHistory,
  getRecentActions
};

const { getDb } = require('../database/init');

function addHistoryLog(db, entityType, entityId, action, oldValue, newValue, operator = 'system') {
  const stmt = db.prepare(`
    INSERT INTO history_logs (entity_type, entity_id, action, old_value, new_value, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    entityType,
    entityId,
    action,
    oldValue !== null ? JSON.stringify(oldValue) : null,
    newValue !== null ? JSON.stringify(newValue) : null,
    operator
  );
}

function getHistory(entityType, entityId, options = {}) {
  const db = getDb();
  const { limit = 100, action = null } = options;
  
  let sql = `
    SELECT id, entity_type, entity_id, action, old_value, new_value, operator, created_at
    FROM history_logs
    WHERE entity_type = ? AND entity_id = ?
  `;
  
  const params = [entityType, entityId];
  
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
  params.push(limit);
  
  const logs = db.prepare(sql).all(...params);
  
  return logs.map(log => ({
    ...log,
    old_value: log.old_value ? safeParse(log.old_value) : null,
    new_value: log.new_value ? safeParse(log.new_value) : null
  }));
}

function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

function getEntityHistorySummary(entityType, entityId) {
  const db = getDb();
  
  const logs = db.prepare(`
    SELECT action, COUNT(*) as count, MAX(created_at) as last_time
    FROM history_logs
    WHERE entity_type = ? AND entity_id = ?
    GROUP BY action
    ORDER BY last_time DESC
  `).all(entityType, entityId);
  
  return logs;
}

function formatHistoryForDisplay(logs) {
  const actionLabels = {
    create: '创建',
    update: '更新',
    delete: '删除',
    assign_cluster: '分配聚类',
    create_ticket: '创建工单',
    assign_department: '分派部门',
    merge: '合并',
    reply: '答复',
    supervise: '督办',
    close: '办结',
    withdraw: '撤回',
    reopen: '重新打开'
  };
  
  return logs.map(log => ({
    time: log.created_at,
    operator: log.operator,
    action: actionLabels[log.action] || log.action,
    details: formatChangeDetails(log)
  }));
}

function formatChangeDetails(log) {
  if (log.action === 'create') {
    if (log.new_value && typeof log.new_value === 'object') {
      const keys = Object.keys(log.new_value).slice(0, 5);
      return `创建成功，包含字段: ${keys.join(', ')}`;
    }
    return '创建成功';
  }
  
  if (log.action === 'reply') {
    const content = log.new_value?.content || '';
    return `答复内容: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`;
  }
  
  if (log.action === 'assign_department') {
    return `从 ${log.old_value || '未分派'} 分派到 ${log.new_value}`;
  }
  
  if (log.action === 'merge') {
    return `工单 ${log.new_value?.source_ticket_id} 合并到 ${log.new_value?.target_ticket_id}`;
  }
  
  if (log.action === 'supervise') {
    return `督办级别: ${log.new_value?.level || '未知'}`;
  }
  
  if (log.action === 'close') {
    return '工单办结';
  }
  
  if (log.action === 'withdraw') {
    return '工单撤回';
  }
  
  if (log.old_value && log.new_value) {
    return '信息已更新';
  }
  
  return null;
}

module.exports = {
  addHistoryLog,
  getHistory,
  getEntityHistorySummary,
  formatHistoryForDisplay
};

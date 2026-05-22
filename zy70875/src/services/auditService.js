const { run, all, generateId, getCurrentTime } = require('../utils/database');

async function recordAuditLog({ taskId, operator, action, beforeData, afterData, reason }) {
  const logId = generateId();
  const now = getCurrentTime();
  
  await run(
    `INSERT INTO audit_logs (id, taskId, operator, action, beforeData, afterData, reason, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      logId,
      taskId,
      operator,
      action,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      reason || null,
      now
    ]
  );
  
  return logId;
}

async function getAuditLogsByTaskId(taskId) {
  const logs = await all('SELECT * FROM audit_logs WHERE taskId = ? ORDER BY timestamp DESC', [taskId]);
  
  return logs.map(log => ({
    ...log,
    beforeData: log.beforeData ? JSON.parse(log.beforeData) : null,
    afterData: log.afterData ? JSON.parse(log.afterData) : null
  }));
}

async function getAuditLogsByBatchId(batchId) {
  const logs = await all(
    `SELECT al.* FROM audit_logs al
     INNER JOIN tasks t ON al.taskId = t.id
     WHERE t.batchId = ?
     ORDER BY al.timestamp DESC`,
    [batchId]
  );
  
  return logs.map(log => ({
    ...log,
    beforeData: log.beforeData ? JSON.parse(log.beforeData) : null,
    afterData: log.afterData ? JSON.parse(log.afterData) : null
  }));
}

module.exports = {
  recordAuditLog,
  getAuditLogsByTaskId,
  getAuditLogsByBatchId
};

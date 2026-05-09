const { runQuery, allQuery } = require('../database');
const { generateId, getCurrentTime } = require('../utils/helpers');

async function createLog(applicationId, operationType, operator, beforeState, afterState, remark) {
  const id = generateId();
  const createTime = getCurrentTime();
  
  const beforeStateStr = beforeState ? JSON.stringify(beforeState) : null;
  const afterStateStr = afterState ? JSON.stringify(afterState) : null;
  
  await runQuery(
    `INSERT INTO operation_logs (id, application_id, operation_type, operator, before_state, after_state, remark, create_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, applicationId, operationType, operator, beforeStateStr, afterStateStr, remark, createTime]
  );
  
  return { id, createTime };
}

async function getLogsByApplication(applicationId) {
  const logs = await allQuery(
    `SELECT * FROM operation_logs WHERE application_id = ? ORDER BY create_time DESC`,
    [applicationId]
  );
  
  return logs.map(log => ({
    ...log,
    before_state: log.before_state ? JSON.parse(log.before_state) : null,
    after_state: log.after_state ? JSON.parse(log.after_state) : null
  }));
}

async function getAllLogs(limit = 100, offset = 0) {
  const logs = await allQuery(
    `SELECT * FROM operation_logs ORDER BY create_time DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  
  return logs.map(log => ({
    ...log,
    before_state: log.before_state ? JSON.parse(log.before_state) : null,
    after_state: log.after_state ? JSON.parse(log.after_state) : null
  }));
}

module.exports = {
  createLog,
  getLogsByApplication,
  getAllLogs
};

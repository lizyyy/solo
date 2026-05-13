const { runQuery } = require('../database/db');

const createLog = async (operationType, targetTable, targetId, oldValue, newValue, operator, remark = '') => {
  const sql = `
    INSERT INTO operation_logs 
    (operation_type, target_table, target_id, old_value, new_value, operator, remark) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  return await runQuery(sql, [
    operationType,
    targetTable,
    targetId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    operator,
    remark
  ]);
};

module.exports = {
  createLog
};

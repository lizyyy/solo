
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// 生成唯一 ID
function generateId() {
  return uuidv4();
}

// 获取当前时间 ISO 格式
function getCurrentTime() {
  return new Date().toISOString();
}

// 生成请求哈希（用于幂等性检查）
function generateRequestHash(method, path, body) {
  const data = `${method}:${path}:${JSON.stringify(body || {})}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 记录操作日志
function logOperation(db, operationType, moduleName, recordId, action, details, operator) {
  const stmt = db.prepare(`
    INSERT INTO operation_logs 
    (id, operation_type, module_name, record_id, action, details, operator, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    generateId(),
    operationType,
    moduleName,
    recordId,
    action,
    JSON.stringify(details),
    operator,
    getCurrentTime()
  );
}

// 记录修改历史
function logChange(db, moduleName, recordId, fieldName, oldValue, newValue, operator) {
  const stmt = db.prepare(`
    INSERT INTO change_history 
    (id, module_name, record_id, field_name, old_value, new_value, operator, changed_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    generateId(),
    moduleName,
    recordId,
    fieldName,
    JSON.stringify(oldValue),
    JSON.stringify(newValue),
    operator,
    getCurrentTime()
  );
}

// 比较两个对象的差异并记录变更历史
function logChanges(db, moduleName, recordId, oldObj, newObj, operator) {
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of allKeys) {
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      logChange(db, moduleName, recordId, key, oldVal, newVal, operator);
    }
  }
}

module.exports = {
  generateId,
  getCurrentTime,
  generateRequestHash,
  logOperation,
  logChange,
  logChanges
};

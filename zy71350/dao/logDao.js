const { getDb } = require('./database');

function createLog(logData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO processing_logs 
    (item_id, batch_id, step, action, severity, rule_code, message, 
     raw_value, expected_value, is_original, is_processed, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    logData.item_id || null,
    logData.batch_id || null,
    logData.step,
    logData.action,
    logData.severity || 'info',
    logData.rule_code || null,
    logData.message,
    logData.raw_value || null,
    logData.expected_value || null,
    logData.is_original ? 1 : 0,
    logData.is_processed ? 1 : 0,
    logData.operator || 'system'
  );
  return result.lastInsertRowid;
}

function batchCreateLogs(logs) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO processing_logs 
    (item_id, batch_id, step, action, severity, rule_code, message, 
     raw_value, expected_value, is_original, is_processed, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((logEntries) => {
    for (const log of logEntries) {
      stmt.run(
        log.item_id || null,
        log.batch_id || null,
        log.step,
        log.action,
        log.severity || 'info',
        log.rule_code || null,
        log.message,
        log.raw_value || null,
        log.expected_value || null,
        log.is_original ? 1 : 0,
        log.is_processed ? 1 : 0,
        log.operator || 'system'
      );
    }
  });
  
  insertMany(logs);
  return logs.length;
}

function getLogsByItem(itemId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM processing_logs 
    WHERE item_id = ? 
    ORDER BY created_at, id
  `).all(itemId);
}

function getLogsByBatch(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM processing_logs 
    WHERE batch_id = ? 
    ORDER BY created_at, id
  `).all(batchId);
}

function getLogsBySeverity(batchId, severity) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM processing_logs 
    WHERE batch_id = ? AND severity = ?
    ORDER BY item_id, created_at
  `).all(batchId, severity);
}

module.exports = {
  createLog,
  batchCreateLogs,
  getLogsByItem,
  getLogsByBatch,
  getLogsBySeverity
};

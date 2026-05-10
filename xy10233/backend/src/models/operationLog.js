const db = require('../db');

const OPERATION_TYPE = {
  TANK_CREATE: 'tank_create',
  TANK_UPDATE: 'tank_update',
  TANK_DELETE: 'tank_delete',
  BATCH_CREATE: 'batch_create',
  BATCH_UPDATE: 'batch_update',
  BATCH_BIND: 'batch_bind',
  BATCH_DELETE: 'batch_delete',
  WATER_QUALITY_IMPORT: 'water_quality_import',
  ALERT_ACKNOWLEDGE: 'alert_acknowledge',
  ALERT_RESOLVE: 'alert_resolve',
  DEATH_LOSS_CREATE: 'death_loss_create',
  DEATH_LOSS_ATTRIBUTE: 'death_loss_attribute',
  SYSTEM: 'system'
};

const createOperationLogTable = `
  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    operator TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`;

const createOperationLogIndex = `
  CREATE INDEX IF NOT EXISTS idx_operation_logs_time 
  ON operation_logs(created_at DESC)
`;

function init() {
  db.exec(createOperationLogTable);
  db.exec(createOperationLogIndex);
}

function getAll(limit = 200) {
  return db.prepare(`
    SELECT * FROM operation_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

function getByTarget(targetType, targetId) {
  return db.prepare(`
    SELECT * FROM operation_logs
    WHERE target_type = ? AND target_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(targetType, targetId);
}

function getByOperator(operator, limit = 100) {
  return db.prepare(`
    SELECT * FROM operation_logs
    WHERE operator = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(operator, limit);
}

function create(log) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO operation_logs (
      id, operation_type, target_type, target_id,
      operator, details, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, log.operation_type, log.target_type || null, log.target_id || null,
    log.operator || null, log.details || null, log.ip_address || null, now
  );
  
  return db.prepare('SELECT * FROM operation_logs WHERE id = ?').get(id);
}

module.exports = {
  init,
  getAll,
  getByTarget,
  getByOperator,
  create,
  OPERATION_TYPE
};

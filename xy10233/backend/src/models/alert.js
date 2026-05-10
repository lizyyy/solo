const db = require('../db');

const ALERT_TYPE = {
  TEMPERATURE_HIGH: 'temperature_high',
  TEMPERATURE_LOW: 'temperature_low',
  SALINITY_HIGH: 'salinity_high',
  SALINITY_LOW: 'salinity_low',
  OXYGEN_HIGH: 'oxygen_high',
  OXYGEN_LOW: 'oxygen_low'
};

const ALERT_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved'
};

const createAlertTable = `
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    tank_id TEXT NOT NULL,
    batch_id TEXT,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    threshold_value REAL NOT NULL,
    actual_value REAL NOT NULL,
    water_quality_id TEXT,
    status TEXT DEFAULT 'active',
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tank_id) REFERENCES tanks(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (water_quality_id) REFERENCES water_quality(id)
  )
`;

function init() {
  db.exec(createAlertTable);
}

function getAll() {
  return db.prepare(`
    SELECT a.*, t.name as tank_name
    FROM alerts a
    LEFT JOIN tanks t ON a.tank_id = t.id
    ORDER BY a.created_at DESC
    LIMIT 500
  `).all();
}

function getActive() {
  return db.prepare(`
    SELECT a.*, t.name as tank_name
    FROM alerts a
    LEFT JOIN tanks t ON a.tank_id = t.id
    WHERE a.status = 'active'
    ORDER BY a.created_at DESC
  `).all();
}

function getByTankId(tankId) {
  return db.prepare(`
    SELECT a.*, t.name as tank_name
    FROM alerts a
    LEFT JOIN tanks t ON a.tank_id = t.id
    WHERE a.tank_id = ?
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all(tankId);
}

function getById(id) {
  return db.prepare(`
    SELECT a.*, t.name as tank_name
    FROM alerts a
    LEFT JOIN tanks t ON a.tank_id = t.id
    WHERE a.id = ?
  `).get(id);
}

function create(alert) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO alerts (
      id, tank_id, batch_id, alert_type, message,
      threshold_value, actual_value, water_quality_id, status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, alert.tank_id, alert.batch_id || null, alert.alert_type, alert.message,
    alert.threshold_value, alert.actual_value, alert.water_quality_id || null,
    ALERT_STATUS.ACTIVE, now
  );
  
  return getById(id);
}

function acknowledge(id, acknowledgedBy) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE alerts 
    SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ?
    WHERE id = ?
  `);
  stmt.run(acknowledgedBy, now, id);
  return getById(id);
}

function resolve(id, resolvedBy, resolutionNotes) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE alerts 
    SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution_notes = ?
    WHERE id = ?
  `);
  stmt.run(resolvedBy, now, resolutionNotes || null, id);
  return getById(id);
}

function remove(id) {
  const stmt = db.prepare('DELETE FROM alerts WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

module.exports = {
  init,
  getAll,
  getActive,
  getByTankId,
  getById,
  create,
  acknowledge,
  resolve,
  remove,
  ALERT_TYPE,
  ALERT_STATUS
};

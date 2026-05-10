const db = require('../db');

const createWaterQualityTable = `
  CREATE TABLE IF NOT EXISTS water_quality (
    id TEXT PRIMARY KEY,
    tank_id TEXT NOT NULL,
    temperature REAL NOT NULL,
    salinity REAL NOT NULL,
    oxygen REAL NOT NULL,
    recorded_at TEXT NOT NULL,
    operator TEXT,
    source TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tank_id) REFERENCES tanks(id)
  )
`;

const createWaterQualityIndex = `
  CREATE INDEX IF NOT EXISTS idx_water_quality_tank_time 
  ON water_quality(tank_id, recorded_at DESC)
`;

function init() {
  db.exec(createWaterQualityTable);
  db.exec(createWaterQualityIndex);
}

function getAll() {
  return db.prepare(`
    SELECT wq.*, t.name as tank_name
    FROM water_quality wq
    LEFT JOIN tanks t ON wq.tank_id = t.id
    ORDER BY wq.recorded_at DESC
    LIMIT 1000
  `).all();
}

function getByTankId(tankId, limit = 100) {
  return db.prepare(`
    SELECT wq.*, t.name as tank_name
    FROM water_quality wq
    LEFT JOIN tanks t ON wq.tank_id = t.id
    WHERE wq.tank_id = ?
    ORDER BY wq.recorded_at DESC
    LIMIT ?
  `).all(tankId, limit);
}

function getByTimeRange(tankId, startTime, endTime) {
  return db.prepare(`
    SELECT wq.*, t.name as tank_name
    FROM water_quality wq
    LEFT JOIN tanks t ON wq.tank_id = t.id
    WHERE wq.tank_id = ? 
      AND wq.recorded_at >= ? 
      AND wq.recorded_at <= ?
    ORDER BY wq.recorded_at ASC
  `).all(tankId, startTime, endTime);
}

function create(record) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO water_quality (
      id, tank_id, temperature, salinity, oxygen,
      recorded_at, operator, source, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, record.tank_id, record.temperature, record.salinity, record.oxygen,
    record.recorded_at || now, record.operator || null, record.source || null,
    record.notes || null, now
  );
  
  return getById(id);
}

function getById(id) {
  return db.prepare(`
    SELECT wq.*, t.name as tank_name
    FROM water_quality wq
    LEFT JOIN tanks t ON wq.tank_id = t.id
    WHERE wq.id = ?
  `).get(id);
}

function getLatestByTankId(tankId) {
  return db.prepare(`
    SELECT wq.*, t.name as tank_name
    FROM water_quality wq
    LEFT JOIN tanks t ON wq.tank_id = t.id
    WHERE wq.tank_id = ?
    ORDER BY wq.recorded_at DESC
    LIMIT 1
  `).get(tankId);
}

function remove(id) {
  const stmt = db.prepare('DELETE FROM water_quality WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

module.exports = {
  init,
  getAll,
  getByTankId,
  getByTimeRange,
  getById,
  getLatestByTankId,
  create,
  remove
};

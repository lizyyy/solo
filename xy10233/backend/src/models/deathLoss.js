const db = require('../db');

const DEATH_CAUSE = {
  UNKNOWN: 'unknown',
  TEMPERATURE: 'temperature',
  SALINITY: 'salinity',
  OXYGEN: 'oxygen',
  DISEASE: 'disease',
  HANDLING: 'handling',
  QUALITY: 'quality'
};

const ATTRIBUTION_STATUS = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  COMPLETED: 'completed',
  DISPUTED: 'disputed'
};

const createDeathLossTable = `
  CREATE TABLE IF NOT EXISTS death_loss (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    tank_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    discovered_at TEXT NOT NULL,
    reported_by TEXT,
    initial_cause TEXT,
    attribution_status TEXT DEFAULT 'pending',
    final_cause TEXT,
    attribution_notes TEXT,
    attributed_to TEXT,
    attributed_by TEXT,
    attributed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (tank_id) REFERENCES tanks(id)
  )
`;

function init() {
  db.exec(createDeathLossTable);
}

function getAll() {
  return db.prepare(`
    SELECT dl.*, b.batch_number, b.species, t.name as tank_name
    FROM death_loss dl
    LEFT JOIN batches b ON dl.batch_id = b.id
    LEFT JOIN tanks t ON dl.tank_id = t.id
    ORDER BY dl.discovered_at DESC
    LIMIT 500
  `).all();
}

function getById(id) {
  return db.prepare(`
    SELECT dl.*, b.batch_number, b.species, t.name as tank_name
    FROM death_loss dl
    LEFT JOIN batches b ON dl.batch_id = b.id
    LEFT JOIN tanks t ON dl.tank_id = t.id
    WHERE dl.id = ?
  `).get(id);
}

function getByBatchId(batchId) {
  return db.prepare(`
    SELECT dl.*, b.batch_number, b.species, t.name as tank_name
    FROM death_loss dl
    LEFT JOIN batches b ON dl.batch_id = b.id
    LEFT JOIN tanks t ON dl.tank_id = t.id
    WHERE dl.batch_id = ?
    ORDER BY dl.discovered_at DESC
  `).all(batchId);
}

function getByTankId(tankId) {
  return db.prepare(`
    SELECT dl.*, b.batch_number, b.species, t.name as tank_name
    FROM death_loss dl
    LEFT JOIN batches b ON dl.batch_id = b.id
    LEFT JOIN tanks t ON dl.tank_id = t.id
    WHERE dl.tank_id = ?
    ORDER BY dl.discovered_at DESC
    LIMIT 100
  `).all(tankId);
}

function create(deathLoss) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO death_loss (
      id, batch_id, tank_id, quantity, discovered_at,
      reported_by, initial_cause, attribution_status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, deathLoss.batch_id, deathLoss.tank_id, deathLoss.quantity,
    deathLoss.discovered_at || now, deathLoss.reported_by || null,
    deathLoss.initial_cause || DEATH_CAUSE.UNKNOWN,
    ATTRIBUTION_STATUS.PENDING, now
  );
  
  return getById(id);
}

function updateStatus(id, status) {
  const stmt = db.prepare(`UPDATE death_loss SET attribution_status = ? WHERE id = ?`);
  stmt.run(status, id);
  return getById(id);
}

function attribute(id, attribution) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE death_loss 
    SET final_cause = ?, attribution_notes = ?, 
        attributed_to = ?, attributed_by = ?, 
        attributed_at = ?, attribution_status = 'completed'
    WHERE id = ?
  `);
  
  stmt.run(
    attribution.final_cause, attribution.attribution_notes || null,
    attribution.attributed_to || null, attribution.attributed_by || null,
    now, id
  );
  
  return getById(id);
}

function remove(id) {
  const stmt = db.prepare('DELETE FROM death_loss WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

module.exports = {
  init,
  getAll,
  getById,
  getByBatchId,
  getByTankId,
  create,
  updateStatus,
  attribute,
  remove,
  DEATH_CAUSE,
  ATTRIBUTION_STATUS
};

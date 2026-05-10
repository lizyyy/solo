const db = require('../db');

const BATCH_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PARTIAL: 'partial'
};

const createBatchTable = `
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    tank_id TEXT,
    batch_number TEXT NOT NULL UNIQUE,
    species TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    source TEXT,
    supplier TEXT,
    status TEXT DEFAULT 'pending',
    death_quantity INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tank_id) REFERENCES tanks(id)
  )
`;

function init() {
  db.exec(createBatchTable);
}

function getAll() {
  return db.prepare(`
    SELECT b.*, t.name as tank_name
    FROM batches b
    LEFT JOIN tanks t ON b.tank_id = t.id
    ORDER BY b.entry_date DESC
  `).all();
}

function getById(id) {
  return db.prepare(`
    SELECT b.*, t.name as tank_name
    FROM batches b
    LEFT JOIN tanks t ON b.tank_id = t.id
    WHERE b.id = ?
  `).get(id);
}

function getByBatchNumber(batchNumber) {
  return db.prepare(`
    SELECT b.*, t.name as tank_name
    FROM batches b
    LEFT JOIN tanks t ON b.tank_id = t.id
    WHERE b.batch_number = ?
  `).get(batchNumber);
}

function getByTankId(tankId) {
  return db.prepare(`
    SELECT b.*, t.name as tank_name
    FROM batches b
    LEFT JOIN tanks t ON b.tank_id = t.id
    WHERE b.tank_id = ?
    ORDER BY b.entry_date DESC
  `).all(tankId);
}

function create(batch) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO batches (
      id, tank_id, batch_number, species, quantity,
      entry_date, source, supplier, status, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, batch.tank_id || null, batch.batch_number, batch.species, batch.quantity,
    batch.entry_date, batch.source || null, batch.supplier || null,
    BATCH_STATUS.PENDING, batch.notes || null,
    now, now
  );
  
  return getById(id);
}

function update(id, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), new Date().toISOString(), id];
  
  const stmt = db.prepare(`UPDATE batches SET ${fields}, updated_at = ? WHERE id = ?`);
  stmt.run(values);
  return getById(id);
}

function bindToTank(batchId, tankId) {
  return update(batchId, {
    tank_id: tankId,
    status: BATCH_STATUS.ACTIVE
  });
}

function addDeath(batchId, quantity) {
  const batch = getById(batchId);
  if (!batch) return null;
  
  const newDeathQuantity = (batch.death_quantity || 0) + quantity;
  const newStatus = newDeathQuantity >= batch.quantity ? BATCH_STATUS.COMPLETED : BATCH_STATUS.PARTIAL;
  
  return update(batchId, {
    death_quantity: newDeathQuantity,
    status: newStatus
  });
}

function remove(id) {
  const stmt = db.prepare('DELETE FROM batches WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

module.exports = {
  init,
  getAll,
  getById,
  getByBatchNumber,
  getByTankId,
  create,
  update,
  bindToTank,
  addDeath,
  remove,
  BATCH_STATUS
};

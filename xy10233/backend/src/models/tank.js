const db = require('../db');

const TANK_STATUS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  ALERT: 'alert',
  OFFLINE: 'offline'
};

const createTankTable = `
  CREATE TABLE IF NOT EXISTS tanks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    species_type TEXT,
    status TEXT DEFAULT 'normal',
    temperature_min REAL DEFAULT 10,
    temperature_max REAL DEFAULT 20,
    salinity_min REAL DEFAULT 25,
    salinity_max REAL DEFAULT 35,
    oxygen_min REAL DEFAULT 5,
    oxygen_max REAL DEFAULT 12,
    current_temperature REAL,
    current_salinity REAL,
    current_oxygen REAL,
    last_check_time TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`;

function init() {
  db.exec(createTankTable);
}

function getAll() {
  return db.prepare('SELECT * FROM tanks ORDER BY name').all();
}

function getById(id) {
  return db.prepare('SELECT * FROM tanks WHERE id = ?').get(id);
}

function getByName(name) {
  return db.prepare('SELECT * FROM tanks WHERE name = ?').get(name);
}

function create(tank) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO tanks (
      id, name, capacity, species_type, status,
      temperature_min, temperature_max,
      salinity_min, salinity_max,
      oxygen_min, oxygen_max,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, tank.name, tank.capacity, tank.species_type || null,
    TANK_STATUS.NORMAL,
    tank.temperature_min || 10, tank.temperature_max || 20,
    tank.salinity_min || 25, tank.salinity_max || 35,
    tank.oxygen_min || 5, tank.oxygen_max || 12,
    now, now
  );
  
  return getById(id);
}

function update(id, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), new Date().toISOString(), id];
  
  const stmt = db.prepare(`UPDATE tanks SET ${fields}, updated_at = ? WHERE id = ?`);
  stmt.run(values);
  return getById(id);
}

function updateStatus(id, status) {
  return update(id, { status });
}

function updateCurrentReadings(id, temperature, salinity, oxygen) {
  const now = new Date().toISOString();
  return update(id, {
    current_temperature: temperature,
    current_salinity: salinity,
    current_oxygen: oxygen,
    last_check_time: now
  });
}

function remove(id) {
  const stmt = db.prepare('DELETE FROM tanks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

module.exports = {
  init,
  getAll,
  getById,
  getByName,
  create,
  update,
  updateStatus,
  updateCurrentReadings,
  remove,
  TANK_STATUS
};

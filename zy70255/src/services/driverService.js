const { getDb, saveDb } = require('../db');
const { UUID, now, CAR_TYPES } = require('../utils');

const getDriverById = (driverId) => {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM drivers WHERE driver_id = ?');
  stmt.bind([driverId]);
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.reset();
    return result;
  }
  stmt.reset();
  return undefined;
};

const createDriver = (name, phone, carType) => {
  const db = getDb();
  const timestamp = now();
  const driverId = UUID();

  if (!CAR_TYPES.includes(carType)) {
    throw new Error(`无效车型: ${carType}`);
  }

  db.run(
    'INSERT INTO drivers (driver_id, name, phone, car_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [driverId, name, phone, carType, timestamp, timestamp]
  );
  saveDb();

  return getDriverById(driverId);
};

const updateDriver = (driverId, updates = {}) => {
  const db = getDb();
  const timestamp = now();

  const updatableFields = ['name', 'phone', 'car_type'];
  const fields = Object.keys(updates).filter(k => updatableFields.includes(k));

  if (fields.length === 0) {
    throw new Error('没有可更新的字段');
  }

  if (updates.car_type && !CAR_TYPES.includes(updates.car_type)) {
    throw new Error(`无效车型: ${updates.car_type}`);
  }

  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  values.push(timestamp, driverId);

  db.run(`UPDATE drivers SET ${setClauses}, updated_at = ? WHERE driver_id = ?`, values);
  saveDb();

  return getDriverById(driverId);
};

const listDrivers = () => {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM drivers ORDER BY created_at DESC');
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  return results;
};

module.exports = {
  getDriverById,
  createDriver,
  updateDriver,
  listDrivers
};

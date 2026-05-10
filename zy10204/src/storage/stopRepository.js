const { getDatabase } = require('./database');

function insertStop(stop) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO stops (id, code, name, address, line_id, stop_order, is_active, created_at, updated_at)
    VALUES (@id, @code, @name, @address, @lineId, @order, @isActive, @createdAt, @updatedAt)
  `);
  const data = {
    ...stop,
    isActive: stop.isActive ? 1 : 0
  };
  stmt.run(data);
  return stop;
}

function findStopByCode(lineId, code) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM stops WHERE line_id = ? AND code = ?').get(lineId, code);
  return row ? mapToStop(row) : null;
}

function findStopById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM stops WHERE id = ?').get(id);
  return row ? mapToStop(row) : null;
}

function getStopsByLineId(lineId, activeOnly = true) {
  const db = getDatabase();
  let query = 'SELECT * FROM stops WHERE line_id = ?';
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY stop_order';
  const rows = db.prepare(query).all(lineId);
  return rows.map(mapToStop);
}

function updateStop(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = {};

  if (updates.name !== undefined) {
    fields.push('name = @name');
    values.name = updates.name;
  }
  if (updates.address !== undefined) {
    fields.push('address = @address');
    values.address = updates.address;
  }
  if (updates.order !== undefined) {
    fields.push('stop_order = @stopOrder');
    values.stopOrder = updates.order;
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = @isActive');
    values.isActive = updates.isActive ? 1 : 0;
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = @updatedAt');
  values.updatedAt = new Date().toISOString();
  values.id = id;

  const stmt = db.prepare(`UPDATE stops SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
  return findStopById(id);
}

function mapToStop(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
    lineId: row.line_id,
    order: row.stop_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  insertStop,
  findStopByCode,
  findStopById,
  getStopsByLineId,
  updateStop
};

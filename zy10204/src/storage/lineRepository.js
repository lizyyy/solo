const { getDatabase } = require('./database');
const models = require('../models/types');

function insertLine(line) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO lines (id, code, name, description, is_active, created_at, updated_at)
    VALUES (@id, @code, @name, @description, @isActive, @createdAt, @updatedAt)
  `);
  const data = {
    ...line,
    isActive: line.isActive ? 1 : 0
  };
  stmt.run(data);
  return line;
}

function findLineByCode(code) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM lines WHERE code = ?').get(code);
  return row ? mapToLine(row) : null;
}

function findLineById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM lines WHERE id = ?').get(id);
  return row ? mapToLine(row) : null;
}

function getAllLines(activeOnly = true) {
  const db = getDatabase();
  let query = 'SELECT * FROM lines';
  if (activeOnly) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY code';
  const rows = db.prepare(query).all();
  return rows.map(mapToLine);
}

function updateLine(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = {};

  if (updates.name !== undefined) {
    fields.push('name = @name');
    values.name = updates.name;
  }
  if (updates.description !== undefined) {
    fields.push('description = @description');
    values.description = updates.description;
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = @isActive');
    values.isActive = updates.isActive ? 1 : 0;
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = @updatedAt');
  values.updatedAt = new Date().toISOString();
  values.id = id;

  const stmt = db.prepare(`UPDATE lines SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
  return findLineById(id);
}

function mapToLine(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  insertLine,
  findLineByCode,
  findLineById,
  getAllLines,
  updateLine
};

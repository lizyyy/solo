const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const SparePart = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO spare_parts (id, code, name, category, unit, current_stock, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.code, data.name, data.category || null, data.unit || '个', data.current_stock || 0, now, now);
    return id;
  },

  findAll: () => db.prepare('SELECT * FROM spare_parts').all(),

  findById: (id) => db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(id),

  findByCode: (code) => db.prepare('SELECT * FROM spare_parts WHERE code = ?').get(code),

  updateStock: (id, quantity) => {
    const now = Date.now();
    db.prepare('UPDATE spare_parts SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?').run(quantity, now, id);
  },

  update: (id, data) => {
    const now = Date.now();
    const fields = [];
    const params = [];
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category); }
    if (data.unit !== undefined) { fields.push('unit = ?'); params.push(data.unit); }
    if (data.current_stock !== undefined) { fields.push('current_stock = ?'); params.push(data.current_stock); }
    fields.push('updated_at = ?');
    params.push(now, id);
    db.prepare(`UPDATE spare_parts SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
};

module.exports = SparePart;

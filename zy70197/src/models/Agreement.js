const { db } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Agreement {
  static create({ name, year, totalAmount }) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO agreements (id, name, year, total_amount, reserved_amount, used_amount, status)
      VALUES (?, ?, ?, ?, 0, 0, 'active')
    `);
    stmt.run(id, name, year, totalAmount);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM agreements WHERE id = ?').get(id);
  }

  static findByNameAndYear(name, year) {
    return db.prepare('SELECT * FROM agreements WHERE name = ? AND year = ?').get(name, year);
  }

  static findAll() {
    return db.prepare('SELECT * FROM agreements ORDER BY created_at DESC').all();
  }

  static update(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.totalAmount !== undefined) {
      fields.push('total_amount = ?');
      values.push(updates.totalAmount);
    }
    if (updates.reservedAmount !== undefined) {
      fields.push('reserved_amount = ?');
      values.push(updates.reservedAmount);
    }
    if (updates.usedAmount !== undefined) {
      fields.push('used_amount = ?');
      values.push(updates.usedAmount);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    
    if (fields.length === 0) return this.findById(id);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE agreements SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  }

  static getAvailableAmount(id) {
    const agreement = this.findById(id);
    if (!agreement) return 0;
    return agreement.total_amount - agreement.reserved_amount - agreement.used_amount;
  }

  static canReserve(id, amount) {
    const available = this.getAvailableAmount(id);
    return available >= amount;
  }
}

module.exports = Agreement;

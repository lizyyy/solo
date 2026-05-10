const { db } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Order {
  static create({ projectId, agreementId, amount, description }) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO orders (id, project_id, agreement_id, amount, status, description)
      VALUES (?, ?, ?, ?, 'reserved', ?)
    `);
    stmt.run(id, projectId, agreementId, amount, description);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  }

  static findByProjectId(projectId) {
    return db.prepare('SELECT * FROM orders WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  }

  static findByAgreementId(agreementId) {
    return db.prepare('SELECT * FROM orders WHERE agreement_id = ? ORDER BY created_at DESC').all(agreementId);
  }

  static findByStatus(status) {
    return db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status);
  }

  static findAll() {
    return db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  }

  static update(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.amount !== undefined) {
      fields.push('amount = ?');
      values.push(updates.amount);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
      
      if (updates.status === 'confirmed') {
        fields.push('confirmed_at = CURRENT_TIMESTAMP');
      } else if (updates.status === 'released') {
        fields.push('released_at = CURRENT_TIMESTAMP');
      }
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    
    if (fields.length === 0) return this.findById(id);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  }
}

module.exports = Order;

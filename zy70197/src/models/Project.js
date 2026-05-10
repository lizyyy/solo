const { db } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Project {
  static create({ name, agreementId }) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, agreement_id, reserved_amount, used_amount, status)
      VALUES (?, ?, ?, 0, 0, 'active')
    `);
    stmt.run(id, name, agreementId);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  static findByAgreementId(agreementId) {
    return db.prepare('SELECT * FROM projects WHERE agreement_id = ? ORDER BY created_at DESC').all(agreementId);
  }

  static findAll() {
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  }

  static update(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
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
    
    const stmt = db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  }

  static getAvailableAmount(id) {
    const project = this.findById(id);
    if (!project) return 0;
    return project.reserved_amount - project.used_amount;
  }

  static canUse(id, amount) {
    const available = this.getAvailableAmount(id);
    return available >= amount;
  }
}

module.exports = Project;

const { db } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class AmountRecord {
  static create({ agreementId, projectId, orderId, type, amount, balance, description }) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO amount_records (id, agreement_id, project_id, order_id, type, amount, balance, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, agreementId, projectId, orderId, type, amount, balance, description);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM amount_records WHERE id = ?').get(id);
  }

  static findByAgreementId(agreementId) {
    return db.prepare('SELECT * FROM amount_records WHERE agreement_id = ? ORDER BY created_at DESC').all(agreementId);
  }

  static findByProjectId(projectId) {
    return db.prepare('SELECT * FROM amount_records WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  }

  static findByOrderId(orderId) {
    return db.prepare('SELECT * FROM amount_records WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
  }

  static findByType(type) {
    return db.prepare('SELECT * FROM amount_records WHERE type = ? ORDER BY created_at DESC').all(type);
  }

  static findAll() {
    return db.prepare('SELECT * FROM amount_records ORDER BY created_at DESC').all();
  }

  static getLatestByAgreementId(agreementId) {
    return db.prepare(`
      SELECT * FROM amount_records 
      WHERE agreement_id = ? 
      ORDER BY created_at DESC, id DESC 
      LIMIT 1
    `).get(agreementId);
  }
}

module.exports = AmountRecord;

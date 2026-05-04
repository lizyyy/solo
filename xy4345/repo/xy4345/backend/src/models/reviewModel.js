const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const reviewModel = {
  getAll: () => {
    return db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  },

  getByRiskId: (riskId) => {
    return db.prepare('SELECT * FROM reviews WHERE risk_id = ? ORDER BY created_at ASC').all(riskId);
  },

  create: (data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO reviews (id, risk_id, reviewer, comment, status_change)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.risk_id,
      data.reviewer,
      data.comment,
      data.status_change
    );
    return reviewModel.getById(id);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM reviews WHERE id = ?');
    return stmt.run(id);
  }
};

module.exports = reviewModel;

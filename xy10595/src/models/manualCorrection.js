const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const ManualCorrection = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO manual_corrections (
        id, target_type, target_id, before_value, after_value,
        diff, operator, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.targetType, data.targetId,
      data.beforeValue ? JSON.stringify(data.beforeValue) : null,
      data.afterValue ? JSON.stringify(data.afterValue) : null,
      data.diff ? JSON.stringify(data.diff) : null,
      data.operator, data.reason || null, now
    );
    return id;
  },

  findAll: () => db.prepare('SELECT * FROM manual_corrections ORDER BY created_at DESC').all(),

  findByTarget: (targetType, targetId) => db.prepare(`
    SELECT * FROM manual_corrections
    WHERE target_type = ? AND target_id = ?
    ORDER BY created_at DESC
  `).all(targetType, targetId)
};

module.exports = ManualCorrection;

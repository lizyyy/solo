const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const PurchaseCycle = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO purchase_cycles (id, part_id, supplier, cycle_days, is_primary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.partId, data.supplier || null, data.cycleDays, data.isPrimary ? 1 : 0, now, now);
    return id;
  },

  findByPart: (partId) => db.prepare('SELECT * FROM purchase_cycles WHERE part_id = ?').all(partId),

  getPrimaryCycle: (partId) => db.prepare(`
    SELECT * FROM purchase_cycles
    WHERE part_id = ? AND is_primary = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).get(partId),

  getMaxCycleDays: (partId) => {
    const result = db.prepare('SELECT MAX(cycle_days) as max_days FROM purchase_cycles WHERE part_id = ?').get(partId);
    return result.max_days || 7;
  }
};

module.exports = PurchaseCycle;

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Consumption = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO consumption_records (id, part_id, equipment_id, quantity, consumption_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.partId, data.equipmentId || null, data.quantity, data.consumptionDate || now, now);
    return id;
  },

  findByPart: (partId) => db.prepare('SELECT * FROM consumption_records WHERE part_id = ? ORDER BY consumption_date DESC').all(partId),

  getRecentConsumption: (partId, days = 90) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return db.prepare(`
      SELECT * FROM consumption_records
      WHERE part_id = ? AND consumption_date >= ?
      ORDER BY consumption_date DESC
    `).all(partId, cutoff);
  },

  getAverageDailyConsumption: (partId, days = 90) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const result = db.prepare(`
      SELECT SUM(quantity) as total, COUNT(*) as records
      FROM consumption_records
      WHERE part_id = ? AND consumption_date >= ?
    `).get(partId, cutoff);
    return {
      total: result.total || 0,
      daily: result.total ? result.total / days : 0
    };
  }
};

module.exports = Consumption;

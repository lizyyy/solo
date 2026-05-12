const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const MinStock = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO min_stock_rules (id, part_id, equipment_id, min_quantity, safety_factor, calculated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.partId, data.equipmentId || null, data.minQuantity, data.safetyFactor || 1.2, data.calculatedAt || now, now, now);
    return id;
  },

  findByPart: (partId) => db.prepare('SELECT * FROM min_stock_rules WHERE part_id = ?').all(partId),

  findByPartAndEquipment: (partId, equipmentId) => db.prepare(`
    SELECT * FROM min_stock_rules
    WHERE part_id = ? AND (equipment_id = ? OR equipment_id IS NULL)
    ORDER BY equipment_id IS NULL ASC
  `).get(partId, equipmentId),

  getMinQuantity: (partId, equipmentId = null) => {
    const rule = MinStock.findByPartAndEquipment(partId, equipmentId);
    return rule ? rule.min_quantity : 0;
  },

  update: (id, data) => {
    const now = Date.now();
    const fields = [];
    const params = [];
    if (data.minQuantity !== undefined) { fields.push('min_quantity = ?'); params.push(data.minQuantity); }
    if (data.safetyFactor !== undefined) { fields.push('safety_factor = ?'); params.push(data.safetyFactor); }
    if (data.calculatedAt !== undefined) { fields.push('calculated_at = ?'); params.push(data.calculatedAt); }
    fields.push('updated_at = ?');
    params.push(now, id);
    db.prepare(`UPDATE min_stock_rules SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
};

module.exports = MinStock;

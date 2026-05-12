const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Alert = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO stock_alerts (
        id, part_id, alert_level, current_stock, min_stock,
        in_transit_quantity, affected_equipments, created_at, is_resolved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.partId, data.alertLevel, data.currentStock, data.minStock,
      data.inTransitQuantity || 0, data.affectedEquipments ? JSON.stringify(data.affectedEquipments) : null, now, 0
    );
    return id;
  },

  findActive: () => db.prepare(`
    SELECT sa.*, sp.code as part_code, sp.name as part_name
    FROM stock_alerts sa
    JOIN spare_parts sp ON sa.part_id = sp.id
    WHERE sa.is_resolved = 0
    ORDER BY
      CASE sa.alert_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'WARNING' THEN 2
        ELSE 3
      END ASC,
      sa.created_at DESC
  `).all(),

  findByPart: (partId) => db.prepare(`
    SELECT * FROM stock_alerts
    WHERE part_id = ?
    ORDER BY created_at DESC
  `).all(partId),

  resolve: (id) => {
    db.prepare('UPDATE stock_alerts SET is_resolved = 1 WHERE id = ?').run(id);
  }
};

module.exports = Alert;

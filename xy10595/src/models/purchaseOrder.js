const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const PurchaseOrder = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO purchase_orders (id, part_id, quantity, in_transit_quantity, expected_arrival_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.partId, data.quantity, data.inTransitQuantity || data.quantity, data.expectedArrivalDate || null, 'IN_TRANSIT', now);
    return id;
  },

  findByPart: (partId) => db.prepare('SELECT * FROM purchase_orders WHERE part_id = ?').all(partId),

  getInTransitQuantity: (partId) => {
    const result = db.prepare(`
      SELECT SUM(in_transit_quantity) as total
      FROM purchase_orders
      WHERE part_id = ? AND status = 'IN_TRANSIT'
    `).get(partId);
    return result.total || 0;
  },

  getInTransitOrders: (partId) => db.prepare(`
    SELECT * FROM purchase_orders
    WHERE part_id = ? AND status = 'IN_TRANSIT'
  `).all(partId)
};

module.exports = PurchaseOrder;

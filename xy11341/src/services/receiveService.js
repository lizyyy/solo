const db = require('../db');
const { maskObject } = require('../utils/mask');

class ReceiveService {
  getReceiveOrders(filters = {}) {
    let sql = 'SELECT * FROM receive_orders WHERE 1=1';
    const params = [];

    if (filters.order_no) {
      sql += ' AND order_no = ?';
      params.push(filters.order_no);
    }

    if (filters.engineer_id) {
      sql += ' AND engineer_id = ?';
      params.push(filters.engineer_id);
    }

    if (filters.batch_no) {
      sql += ' AND batch_no = ?';
      params.push(filters.batch_no);
    }

    if (filters.old_part_returned !== undefined) {
      sql += ' AND old_part_returned = ?';
      params.push(filters.old_part_returned ? 1 : 0);
    }

    if (filters.claim_status) {
      sql += ' AND claim_status = ?';
      params.push(filters.claim_status);
    }

    sql += ' ORDER BY created_at DESC';

    const orders = db.prepare(sql).all(...params);
    return orders.map(order => maskObject(order));
  }

  getReceiveOrderById(id) {
    const order = db.prepare('SELECT * FROM receive_orders WHERE id = ?').get(id);
    return order ? maskObject(order) : null;
  }

  getReceiveOrderByNo(orderNo) {
    const order = db.prepare('SELECT * FROM receive_orders WHERE order_no = ?').get(orderNo);
    return order ? maskObject(order) : null;
  }

  getStatistics() {
    const total = db.prepare('SELECT COUNT(*) as count FROM receive_orders').get().count;
    const returned = db.prepare('SELECT COUNT(*) as count FROM receive_orders WHERE old_part_returned = 1').get().count;
    const claimed = db.prepare('SELECT COUNT(*) as count FROM receive_orders WHERE claim_status = "claimed"').get().count;
    const pendingReturn = total - returned;
    const pendingClaim = returned - claimed;

    return {
      total,
      oldPartReturned: returned,
      oldPartPending: pendingReturn,
      claimed,
      claimPending: pendingClaim,
    };
  }
}

module.exports = new ReceiveService();

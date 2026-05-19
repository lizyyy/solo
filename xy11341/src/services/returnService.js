const db = require('../db');
const { logAction } = require('../utils/audit');

class ReturnService {
  createReturn(returnData) {
    const { receive_order_no, quantity, return_date, remarks } = returnData;

    const receiveOrder = db.prepare('SELECT * FROM receive_orders WHERE order_no = ?').get(receive_order_no);
    if (!receiveOrder) {
      return { success: false, error: '领件单不存在' };
    }

    if (receiveOrder.old_part_returned === 1) {
      return { success: false, error: '该领件单旧件已返还' };
    }

    const returnNo = `RT${Date.now()}`;

    const insertReturn = db.prepare(`
      INSERT INTO old_part_returns 
      (return_no, receive_order_id, receive_order_no, engineer_id, part_code, batch_no, quantity, return_date, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateReceiveOrder = db.prepare(`
      UPDATE receive_orders 
      SET old_part_returned = 1, old_part_return_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    try {
      db.exec('BEGIN TRANSACTION');

      const returnResult = insertReturn.run(
        returnNo,
        receiveOrder.id,
        receiveOrder.order_no,
        receiveOrder.engineer_id,
        receiveOrder.part_code,
        receiveOrder.batch_no,
        quantity || receiveOrder.quantity,
        return_date || new Date().toISOString().split('T')[0],
        remarks || null
      );

      updateReceiveOrder.run(
        return_date || new Date().toISOString().split('T')[0],
        receiveOrder.id
      );

      db.exec('COMMIT');

      logAction('create', 'old_part_return', {
        entityId: returnResult.lastInsertRowid,
        entityNo: returnNo,
        afterData: { ...returnData, return_no: returnNo },
      });

      return {
        success: true,
        returnNo,
        receiveOrderNo: receive_order_no,
      };
    } catch (error) {
      db.exec('ROLLBACK');
      return { success: false, error: error.message };
    }
  }

  bulkCreateReturns(returnsData) {
    const results = {
      success: [],
      failed: [],
    };

    for (const data of returnsData) {
      const result = this.createReturn(data);
      if (result.success) {
        results.success.push(result);
      } else {
        results.failed.push({ ...data, error: result.error });
      }
    }

    return results;
  }

  getReturns(filters = {}) {
    let sql = 'SELECT * FROM old_part_returns WHERE 1=1';
    const params = [];

    if (filters.receive_order_no) {
      sql += ' AND receive_order_no = ?';
      params.push(filters.receive_order_no);
    }

    if (filters.engineer_id) {
      sql += ' AND engineer_id = ?';
      params.push(filters.engineer_id);
    }

    sql += ' ORDER BY created_at DESC';

    return db.prepare(sql).all(...params);
  }
}

module.exports = new ReturnService();

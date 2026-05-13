const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('../utils/history');
router.get('/', (req, res) => {
  db.all('SELECT * FROM split_orders ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询拆单失败' });
    }
    res.json({ success: true, data: rows });
  });
});
router.post('/', (req, res) => {
  const { parent_order_id, split_order_no, split_type, total_amount, items, operator } = req.body;
  const id = uuidv4();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.get('SELECT * FROM orders WHERE id = ?', [parent_order_id], (err, parentOrder) => {
      if (err || !parentOrder) {
        db.run('ROLLBACK');
        return res.status(404).json({ success: false, error: '父订单不存在' });
      }
      db.run(
        `INSERT INTO split_orders (id, parent_order_id, split_order_no, split_type, total_amount, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'completed', ?)`,
        [id, parent_order_id, split_order_no, split_type, total_amount, operator || 'system'],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, error: '创建拆单失败' });
          }
          const beforeOrder = { status: parentOrder.status };
          db.run(
            `UPDATE orders SET status = 'split', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [parent_order_id],
            async function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, error: '更新父订单状态失败' });
              }
              await recordStatusHistory('split_order', id, null, 'completed', operator || 'system', `拆单类型: ${split_type}`);
              await recordStatusHistory('order', parent_order_id, parentOrder.status, 'split', operator || 'system', '订单已拆单', beforeOrder, { status: 'split' });
              db.run('COMMIT');
              res.json({ success: true, data: { id, parent_order_id, split_order_no, split_type, total_amount } });
            }
          );
        }
      );
    });
  });
});
module.exports = router;

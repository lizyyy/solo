const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('../utils/history');
router.get('/', (req, res) => {
  db.all('SELECT * FROM refunds ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询退款失败' });
    }
    res.json({ success: true, data: rows });
  });
});
router.post('/', (req, res) => {
  const { order_id, order_item_id, refund_no, refund_type, refund_amount, refund_quantity, reason, operator } = req.body;
  const id = uuidv4();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.get('SELECT * FROM orders WHERE id = ?', [order_id], (err, order) => {
      if (err || !order) {
        db.run('ROLLBACK');
        return res.status(404).json({ success: false, error: '订单不存在' });
      }
      let affectGift = 0;
      if (order.gift_qualified === 1) {
        db.get('SELECT * FROM activities WHERE id = ?', [order.activity_id], (err, activity) => {
          if (!err && activity) {
            const newAmount = order.total_amount - refund_amount;
            if (newAmount < activity.threshold_amount) {
              affectGift = 1;
            }
          }
        });
      }
      db.run(
        `INSERT INTO refunds (id, order_id, order_item_id, refund_no, refund_type, refund_amount, refund_quantity, reason, operator, status, affect_gift)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
        [id, order_id, order_item_id, refund_no, refund_type, refund_amount, refund_quantity || 0, reason, operator, affectGift],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, error: '创建退款失败' });
          }
          if (order_item_id) {
            db.run(
              `UPDATE order_items
               SET refund_quantity = refund_quantity + ?, refund_amount = refund_amount + ?
               WHERE id = ?`,
              [refund_quantity || 0, refund_amount, order_item_id]
            );
          }
          await recordStatusHistory('refund', id, null, 'approved', operator, `退款原因: ${reason}, 影响赠品: ${affectGift ? '是' : '否'}`);
          if (affectGift === 1 && order.gift_product_id) {
            db.run(
              `UPDATE gift_inventory
               SET used_quantity = used_quantity - ?, available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
               WHERE product_id = ?`,
              [order.gift_quantity, order.gift_quantity, order.gift_product_id]
            );
            const beforeOrder = { gift_qualified: order.gift_qualified, gift_quantity: order.gift_quantity, status: order.status };
            db.run(
              `UPDATE orders
               SET gift_qualified = 0, gift_quantity = 0, status = 'gift_cancelled', updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [order_id],
              async function(err) {
                if (!err) {
                  await recordStatusHistory(
                    'order',
                    order_id,
                    order.status,
                    'gift_cancelled',
                    operator,
                    '退款导致赠品资格取消',
                    beforeOrder,
                    { gift_qualified: 0, gift_quantity: 0, status: 'gift_cancelled' }
                  );
                }
              }
            );
          }
          db.run('COMMIT');
          res.json({
            success: true,
            data: { id, order_id, refund_no, refund_amount, affect_gift: affectGift }
          });
        }
      );
    });
  });
});
module.exports = router;

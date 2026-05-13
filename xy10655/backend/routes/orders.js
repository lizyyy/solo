const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('../utils/history');
router.get('/', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询订单失败' });
    }
    res.json({ success: true, data: rows });
  });
});
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err || !order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    db.all('SELECT * FROM order_items WHERE order_id = ?', [id], (err, items) => {
      if (err) {
        return res.status(500).json({ success: false, error: '查询订单项失败' });
      }
      res.json({ success: true, data: { ...order, items } });
    });
  });
});
router.post('/', (req, res) => {
  const { order_no, user_id, user_name, total_amount, activity_id, items } = req.body;
  const id = uuidv4();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(
      `INSERT INTO orders (id, order_no, user_id, user_name, total_amount, activity_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, order_no, user_id, user_name, total_amount, activity_id],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, error: '创建订单失败' });
        }
        const itemPromises = items.map(item => {
          return new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, amount, is_gift)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuidv4(), id, item.product_id, item.product_name, item.price, item.quantity, item.amount, item.is_gift || 0],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });
        Promise.all(itemPromises).then(async () => {
          await recordStatusHistory('order', id, null, 'pending', 'system', '创建订单');
          db.run('COMMIT');
          res.json({ success: true, data: { id, order_no, user_name, total_amount } });
        }).catch(() => {
          db.run('ROLLBACK');
          res.status(500).json({ success: false, error: '创建订单项失败' });
        });
      }
    );
  });
});
router.post('/:id/check-qualification', (req, res) => {
  const { id } = req.params;
  const { operator } = req.body;
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err || !order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    if (!order.activity_id) {
      return res.status(400).json({ success: false, error: '订单未关联活动' });
    }
    db.get('SELECT * FROM activities WHERE id = ?', [order.activity_id], (err, activity) => {
      if (err || !activity) {
        return res.status(404).json({ success: false, error: '活动不存在' });
      }
      db.get('SELECT * FROM gift_inventory WHERE product_id = ?', [activity.gift_product_id], (err, inventory) => {
        if (err || !inventory) {
          return res.status(404).json({ success: false, error: '赠品库存不存在' });
        }
        const beforeData = { gift_qualified: order.gift_qualified, gift_quantity: order.gift_quantity };
        const giftQualified = order.total_amount >= activity.threshold_amount ? 1 : 0;
        const giftQuantity = giftQualified ? activity.gift_quantity : 0;
        let hasStock = true;
        if (giftQualified && inventory.available_quantity < giftQuantity) {
          hasStock = false;
        }
        const finalQualified = giftQualified && hasStock ? 1 : 0;
        db.run(
          `UPDATE orders
           SET gift_qualified = ?, gift_product_id = ?, gift_quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [finalQualified, finalQualified ? activity.gift_product_id : null, finalQualified ? giftQuantity : 0, finalQualified ? 'gift_qualified' : 'gift_not_qualified', id],
          async function(err) {
            if (err) {
              return res.status(500).json({ success: false, error: '更新订单资格失败' });
            }
            await recordStatusHistory(
              'order',
              id,
              order.status,
              finalQualified ? 'gift_qualified' : 'gift_not_qualified',
              operator || 'system',
              finalQualified ? '订单满足赠品资格' : '订单不满足赠品资格或库存不足',
              beforeData,
              { gift_qualified: finalQualified, gift_quantity: giftQuantity }
            );
            res.json({
              success: true,
              data: {
                qualified: finalQualified === 1,
                order_amount: order.total_amount,
                threshold: activity.threshold_amount,
                gift_product_id: activity.gift_product_id,
                gift_quantity: giftQuantity,
                stock_available: inventory.available_quantity,
                stock_sufficient: hasStock
              }
            });
          }
        );
      });
    });
  });
});
module.exports = router;

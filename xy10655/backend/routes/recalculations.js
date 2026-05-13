const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('../utils/history');
router.get('/', (req, res) => {
  db.all('SELECT * FROM qualification_recalculations ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询重算记录失败' });
    }
    res.json({ success: true, data: rows });
  });
});
router.post('/', (req, res) => {
  const { order_id, recalculate_type, operator } = req.body;
  const id = uuidv4();
  db.get('SELECT * FROM orders WHERE id = ?', [order_id], (err, order) => {
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
        const beforeData = {
          gift_qualified: order.gift_qualified,
          gift_quantity: order.gift_quantity,
          order_amount: order.total_amount,
          threshold: activity.threshold_amount
        };
        const giftQualified = order.total_amount >= activity.threshold_amount ? 1 : 0;
        const giftQuantity = giftQualified ? activity.gift_quantity : 0;
        let hasStock = true;
        if (giftQualified && inventory.available_quantity < giftQuantity) {
          hasStock = false;
        }
        const finalQualified = giftQualified && hasStock ? 1 : 0;
        const afterData = {
          gift_qualified: finalQualified,
          gift_quantity: finalQualified ? giftQuantity : 0,
          order_amount: order.total_amount,
          threshold: activity.threshold_amount,
          stock_available: inventory.available_quantity,
          stock_sufficient: hasStock
        };
        db.run(
          `UPDATE orders
           SET gift_qualified = ?, gift_product_id = ?, gift_quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [finalQualified, finalQualified ? activity.gift_product_id : null, finalQualified ? giftQuantity : 0, finalQualified ? 'gift_qualified' : 'gift_not_qualified', order_id],
          async function(err) {
            if (err) {
              return res.status(500).json({ success: false, error: '更新订单资格失败' });
            }
            db.run(
              `INSERT INTO qualification_recalculations (id, order_id, recalculate_type, before_data, after_data, result, operator)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, order_id, recalculate_type, JSON.stringify(beforeData), JSON.stringify(afterData), finalQualified ? 'qualified' : 'not_qualified', operator]
            );
            await recordStatusHistory(
              'order',
              order_id,
              order.status,
              finalQualified ? 'gift_qualified' : 'gift_not_qualified',
              operator,
              `资格重算类型: ${recalculate_type}`,
              beforeData,
              afterData
            );
            res.json({
              success: true,
              data: {
                id,
                order_id,
                before: beforeData,
                after: afterData,
                result: finalQualified ? 'qualified' : 'not_qualified'
              }
            });
          }
        );
      });
    });
  });
});
module.exports = router;

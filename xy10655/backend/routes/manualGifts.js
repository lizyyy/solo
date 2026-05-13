const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('../utils/history');
router.get('/', (req, res) => {
  db.all('SELECT * FROM manual_gifts ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询人工补赠失败' });
    }
    res.json({ success: true, data: rows });
  });
});
router.post('/', (req, res) => {
  const { order_id, user_id, gift_product_id, gift_product_name, gift_quantity, reason, operator } = req.body;
  const id = uuidv4();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.get('SELECT * FROM gift_inventory WHERE product_id = ?', [gift_product_id], (err, inventory) => {
      if (err || !inventory) {
        db.run('ROLLBACK');
        return res.status(404).json({ success: false, error: '赠品不存在' });
      }
      if (inventory.available_quantity < gift_quantity) {
        db.run('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: '库存不足',
          available: inventory.available_quantity,
          requested: gift_quantity
        });
      }
      const beforeInventory = { ...inventory };
      db.run(
        `UPDATE gift_inventory
         SET used_quantity = used_quantity + ?, available_quantity = available_quantity - ?, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = ?`,
        [gift_quantity, gift_quantity, gift_product_id],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, error: '扣减库存失败' });
          }
          db.run(
            `INSERT INTO manual_gifts (id, order_id, user_id, gift_product_id, gift_product_name, gift_quantity, reason, operator, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
            [id, order_id, user_id, gift_product_id, gift_product_name, gift_quantity, reason, operator],
            async function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, error: '创建人工补赠失败' });
              }
              await recordStatusHistory(
                'manual_gift',
                id,
                null,
                'approved',
                operator,
                `补赠原因: ${reason}`
              );
              await recordStatusHistory(
                'inventory',
                inventory.id,
                'available',
                'deduct',
                operator,
                `人工补赠扣减库存，订单: ${order_id}`,
                beforeInventory,
                { ...beforeInventory, used_quantity: beforeInventory.used_quantity + gift_quantity, available_quantity: beforeInventory.available_quantity - gift_quantity }
              );
              db.run('COMMIT');
              res.json({
                success: true,
                data: { id, order_id, gift_product_id, gift_product_name, gift_quantity }
              });
            }
          );
        }
      );
    });
  });
});
module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('../utils/history');
router.get('/', (req, res) => {
  db.all('SELECT * FROM gift_inventory ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询库存失败' });
    }
    res.json({ success: true, data: rows });
  });
});
router.post('/', (req, res) => {
  const { product_id, product_name, total_quantity } = req.body;
  const id = uuidv4();
  const available_quantity = total_quantity;
  db.run(
    `INSERT INTO gift_inventory (id, product_id, product_name, total_quantity, used_quantity, available_quantity)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, product_id, product_name, total_quantity, available_quantity],
    async function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: '创建库存失败' });
      }
      await recordStatusHistory('inventory', id, null, 'created', 'system', '创建赠品库存');
      res.json({ success: true, data: { id, product_id, product_name, total_quantity, used_quantity: 0, available_quantity } });
    }
  );
});
router.post('/check-deduct', (req, res) => {
  const { product_id, quantity, order_id, operator } = req.body;
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.get('SELECT * FROM gift_inventory WHERE product_id = ?', [product_id], (err, inventory) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ success: false, error: '查询库存失败' });
      }
      if (!inventory) {
        db.run('ROLLBACK');
        return res.status(404).json({ success: false, error: '赠品不存在' });
      }
      if (inventory.available_quantity < quantity) {
        db.run('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: '库存不足',
          available: inventory.available_quantity,
          requested: quantity
        });
      }
      const beforeData = { ...inventory };
      db.run(
        `UPDATE gift_inventory
         SET used_quantity = used_quantity + ?, available_quantity = available_quantity - ?, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = ?`,
        [quantity, quantity, product_id],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, error: '扣减库存失败' });
          }
          await recordStatusHistory(
            'inventory',
            inventory.id,
            'available',
            'deduct',
            operator || 'system',
            `订单${order_id}扣减赠品库存`,
            beforeData,
            { ...beforeData, used_quantity: beforeData.used_quantity + quantity, available_quantity: beforeData.available_quantity - quantity }
          );
          db.run('COMMIT');
          res.json({ success: true, message: '库存扣减成功' });
        }
      );
    });
  });
});
router.post('/return', (req, res) => {
  const { product_id, quantity, order_id, operator } = req.body;
  db.get('SELECT * FROM gift_inventory WHERE product_id = ?', [product_id], (err, inventory) => {
    if (err || !inventory) {
      return res.status(404).json({ success: false, error: '赠品不存在' });
    }
    const beforeData = { ...inventory };
    db.run(
      `UPDATE gift_inventory
       SET used_quantity = used_quantity - ?, available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
       WHERE product_id = ?`,
      [quantity, quantity, product_id],
      async function(err) {
        if (err) {
          return res.status(500).json({ success: false, error: '归还库存失败' });
        }
        await recordStatusHistory(
          'inventory',
          inventory.id,
          'deduct',
          'return',
          operator || 'system',
          `订单${order_id}归还赠品库存`,
          beforeData,
          { ...beforeData, used_quantity: beforeData.used_quantity - quantity, available_quantity: beforeData.available_quantity + quantity }
        );
        res.json({ success: true, message: '库存归还成功' });
      }
    );
  });
});
module.exports = router;

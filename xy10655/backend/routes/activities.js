const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { recordStatusHistory } = require('../utils/history');
router.get('/', (req, res) => {
  db.all('SELECT * FROM activities ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询活动失败' });
    }
    res.json({ success: true, data: rows });
  });
});
router.post('/', (req, res) => {
  const { name, threshold_amount, gift_product_id, gift_quantity } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO activities (id, name, threshold_amount, gift_product_id, gift_quantity, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [id, name, threshold_amount, gift_product_id, gift_quantity],
    async function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: '创建活动失败' });
      }
      await recordStatusHistory('activity', id, null, 'active', 'system', '创建活动');
      res.json({ success: true, data: { id, ...req.body } });
    }
  );
});
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, threshold_amount, gift_product_id, gift_quantity, status, operator } = req.body;
  db.get('SELECT * FROM activities WHERE id = ?', [id], async (err, beforeData) => {
    if (err || !beforeData) {
      return res.status(404).json({ success: false, error: '活动不存在' });
    }
    db.run(
      `UPDATE activities SET name = ?, threshold_amount = ?, gift_product_id = ?, gift_quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, threshold_amount, gift_product_id, gift_quantity, status, id],
      async function(err) {
        if (err) {
          return res.status(500).json({ success: false, error: '更新活动失败' });
        }
        if (beforeData.status !== status) {
          await recordStatusHistory('activity', id, beforeData.status, status, operator || 'system', '更新活动状态', beforeData, { ...beforeData, ...req.body });
        }
        res.json({ success: true, message: '更新成功' });
      }
    );
  });
});
module.exports = router;

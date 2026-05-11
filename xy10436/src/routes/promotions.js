const express = require('express');
const db = require('../db');
const router = express.Router();

router.post('/full-reduction', (req, res) => {
  const { stream_id, name, threshold_amount, discount_amount, priority } = req.body;
  
  if (!stream_id || !name || threshold_amount === undefined || discount_amount === undefined) {
    return res.status(400).json({ error: '直播场次ID、名称、门槛金额和减免金额必填' });
  }

  const stream = db.prepare('SELECT * FROM streams WHERE id = ?').get(stream_id);
  if (!stream) return res.status(404).json({ error: '直播场次不存在' });

  const stmt = db.prepare(`
    INSERT INTO full_reductions (stream_id, name, threshold_amount, discount_amount, priority)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(stream_id, name, threshold_amount, discount_amount, priority || 1);
  
  res.json({ id: result.lastInsertRowid, message: '满减规则创建成功' });
});

router.get('/full-reduction', (req, res) => {
  const { stream_id } = req.query;
  let sql = 'SELECT * FROM full_reductions WHERE 1=1';
  const params = [];
  
  if (stream_id) {
    sql += ' AND stream_id = ?';
    params.push(stream_id);
  }
  sql += ' ORDER BY priority DESC, threshold_amount DESC';
  
  const reductions = db.prepare(sql).all(...params);
  res.json(reductions);
});

router.post('/gift', (req, res) => {
  const { stream_id, name, threshold_amount, gift_product_id, gift_quantity, stock } = req.body;
  
  if (!stream_id || !name || threshold_amount === undefined || !gift_product_id) {
    return res.status(400).json({ error: '直播场次ID、名称、门槛金额和赠品商品ID必填' });
  }

  const stream = db.prepare('SELECT * FROM streams WHERE id = ?').get(stream_id);
  if (!stream) return res.status(404).json({ error: '直播场次不存在' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(gift_product_id);
  if (!product) return res.status(404).json({ error: '赠品商品不存在' });

  const stmt = db.prepare(`
    INSERT INTO gifts (stream_id, name, threshold_amount, gift_product_id, gift_quantity, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    stream_id,
    name,
    threshold_amount,
    gift_product_id,
    gift_quantity || 1,
    stock || 0
  );
  
  res.json({ id: result.lastInsertRowid, message: '赠品规则创建成功' });
});

router.get('/gift', (req, res) => {
  const { stream_id } = req.query;
  let sql = `
    SELECT g.*, p.name as gift_product_name 
    FROM gifts g
    JOIN products p ON g.gift_product_id = p.id
    WHERE 1=1
  `;
  const params = [];
  
  if (stream_id) {
    sql += ' AND g.stream_id = ?';
    params.push(stream_id);
  }
  sql += ' ORDER BY g.threshold_amount DESC';
  
  const gifts = db.prepare(sql).all(...params);
  res.json(gifts);
});

module.exports = router;

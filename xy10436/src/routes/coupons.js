const express = require('express');
const db = require('../db');
const router = express.Router();

router.post('/', (req, res) => {
  const { 
    stream_id, 
    type, 
    name, 
    discount_type, 
    discount_value, 
    min_amount, 
    stock,
    is_mutual_exclusive 
  } = req.body;
  
  if (!type || !name || !discount_type || discount_value === undefined) {
    return res.status(400).json({ error: '类型、名称、折扣类型和折扣值必填' });
  }

  if (!['platform', 'anchor'].includes(type)) {
    return res.status(400).json({ error: '券类型必须是 platform 或 anchor' });
  }

  if (!['fixed', 'percentage'].includes(discount_type)) {
    return res.status(400).json({ error: '折扣类型必须是 fixed 或 percentage' });
  }

  if (type === 'anchor' && !stream_id) {
    return res.status(400).json({ error: '主播券必须关联直播场次' });
  }

  const stmt = db.prepare(`
    INSERT INTO coupons (stream_id, type, name, discount_type, discount_value, min_amount, stock, is_mutual_exclusive)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    type === 'anchor' ? stream_id : null,
    type,
    name,
    discount_type,
    discount_value,
    min_amount || 0,
    stock !== undefined ? stock : -1,
    is_mutual_exclusive ? 1 : 0
  );
  
  res.json({ id: result.lastInsertRowid, message: '优惠券创建成功' });
});

router.get('/', (req, res) => {
  const { type, stream_id } = req.query;
  let sql = 'SELECT * FROM coupons WHERE 1=1';
  const params = [];
  
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (stream_id) {
    sql += ' AND stream_id = ?';
    params.push(stream_id);
  }
  
  const coupons = db.prepare(sql).all(...params);
  res.json(coupons);
});

router.get('/:id', (req, res) => {
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
  if (!coupon) return res.status(404).json({ error: '优惠券不存在' });
  res.json(coupon);
});

module.exports = router;

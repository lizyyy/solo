const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

router.get('/', (req, res) => {
  const regions = db.all(`
    SELECT r.*,
      (SELECT COUNT(*) FROM stores WHERE region_id = r.id) as store_count
    FROM regions r
    ORDER BY r.name
  `);

  res.json(regions);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const region = db.get(`
    SELECT r.*,
      (SELECT COUNT(*) FROM stores WHERE region_id = r.id) as store_count
    FROM regions r
    WHERE r.id = ?
  `, [id]);

  if (!region) {
    return res.status(404).json({ error: '区域不存在' });
  }

  const stores = db.all(`
    SELECT s.*,
      (SELECT COUNT(*) FROM store_tasks WHERE store_id = s.id AND status = 'pending') as pending_tasks,
      (SELECT COUNT(*) FROM store_tasks WHERE store_id = s.id AND status = 'confirmed') as confirmed_tasks
    FROM stores s
    WHERE s.region_id = ?
    ORDER BY s.name
  `, [id]);

  res.json({ ...region, stores });
});

router.post('/', (req, res) => {
  const { name, code } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const existing = db.get('SELECT id FROM regions WHERE code = ?', [code]);
    if (existing) {
      throw new Error('区域编码已存在');
    }

    const id = uuidv4();
    
    db.run(`
      INSERT INTO regions (id, name, code)
      VALUES (?, ?, ?)
    `, [id, name, code]);

    res.json({ id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, code } = req.body;

  try {
    const region = db.get('SELECT * FROM regions WHERE id = ?', [id]);
    if (!region) {
      throw new Error('区域不存在');
    }

    if (code && code !== region.code) {
      const existing = db.get('SELECT id FROM regions WHERE code = ? AND id != ?', [code, id]);
      if (existing) {
        throw new Error('区域编码已存在');
      }
    }

    db.run(`
      UPDATE regions SET name = ?, code = ? WHERE id = ?
    `, [name || region.name, code || region.code, id]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

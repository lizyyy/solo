const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

router.get('/', (req, res) => {
  const { regionId, status } = req.query;
  
  let whereClause = '1=1';
  const params = [];

  if (regionId) {
    whereClause += ' AND s.region_id = ?';
    params.push(regionId);
  }

  if (status) {
    whereClause += ' AND s.status = ?';
    params.push(status);
  }

  const stores = db.all(`
    SELECT s.*, r.name as region_name, r.code as region_code
    FROM stores s
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE ${whereClause}
    ORDER BY r.name, s.name
  `, params);

  res.json(stores);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const store = db.get(`
    SELECT s.*, r.name as region_name, r.code as region_code
    FROM stores s
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE s.id = ?
  `, [id]);

  if (!store) {
    return res.status(404).json({ error: '门店不存在' });
  }

  const tasks = db.all(`
    SELECT st.*, pa.adjustment_no, pa.title as adjustment_title, pa.effect_time, pa.type as adjustment_type,
      (SELECT COUNT(*) FROM task_items WHERE store_task_id = st.id) as total_items,
      (SELECT COUNT(*) FROM task_items WHERE store_task_id = st.id AND status = 'confirmed') as confirmed_items
    FROM store_tasks st
    JOIN price_adjustments pa ON st.adjustment_id = pa.id
    WHERE st.store_id = ?
    ORDER BY pa.effect_time ASC
  `, [id]);

  const pendingTasks = tasks.filter(t => t.status === 'pending');

  res.json({ ...store, tasks, pendingTasks });
});

router.post('/', (req, res) => {
  const { name, code, regionId, address, phone } = req.body;

  if (!name || !code || !regionId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const existing = db.get('SELECT id FROM stores WHERE code = ?', [code]);
    if (existing) {
      throw new Error('门店编码已存在');
    }

    const id = uuidv4();
    
    db.run(`
      INSERT INTO stores (id, name, code, region_id, address, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [id, name, code, regionId, address || null, phone || null]);

    res.json({ id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, code, regionId, address, phone, status } = req.body;

  try {
    const store = db.get('SELECT * FROM stores WHERE id = ?', [id]);
    if (!store) {
      throw new Error('门店不存在');
    }

    if (code && code !== store.code) {
      const existing = db.get('SELECT id FROM stores WHERE code = ? AND id != ?', [code, id]);
      if (existing) {
        throw new Error('门店编码已存在');
      }
    }

    db.run(`
      UPDATE stores 
      SET name = ?, code = ?, region_id = ?, address = ?, phone = ?, status = ?
      WHERE id = ?
    `, [name || store.name, code || store.code, regionId || store.region_id, address || null, phone || null, status || store.status, id]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

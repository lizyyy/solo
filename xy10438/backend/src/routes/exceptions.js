const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { status, type, regionId } = req.query;
  
  let whereClause = '1=1';
  const params = [];

  if (status) {
    whereClause += ' AND e.status = ?';
    params.push(status);
  }

  if (type) {
    whereClause += ' AND e.type = ?';
    params.push(type);
  }

  let regionFilter = '';
  let regionParams = [];
  if (regionId) {
    regionFilter = 'AND s.region_id = ?';
    regionParams.push(regionId);
  }

  const exceptions = db.all(`
    SELECT e.*, u.name as reporter_name,
      s.name as store_name, s.code as store_code, s.region_id, r.name as region_name,
      pa.adjustment_no, pa.title as adjustment_title,
      p.sku, p.name as product_name
    FROM exceptions e
    LEFT JOIN users u ON e.reported_by = u.id
    LEFT JOIN store_tasks st ON e.store_task_id = st.id
    LEFT JOIN stores s ON st.store_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    LEFT JOIN price_adjustments pa ON st.adjustment_id = pa.id
    LEFT JOIN price_adjustment_items pai ON e.adjustment_item_id = pai.id
    LEFT JOIN products p ON pai.product_id = p.id
    WHERE ${whereClause} ${regionFilter}
    ORDER BY e.created_at DESC
  `, [...params, ...regionParams]);

  res.json(exceptions);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const exception = db.get(`
    SELECT e.*, u.name as reporter_name, ru.name as resolver_name,
      s.name as store_name, s.code as store_code, s.region_id, r.name as region_name,
      pa.adjustment_no, pa.title as adjustment_title,
      p.sku, p.name as product_name
    FROM exceptions e
    LEFT JOIN users u ON e.reported_by = u.id
    LEFT JOIN users ru ON e.resolved_by = ru.id
    LEFT JOIN store_tasks st ON e.store_task_id = st.id
    LEFT JOIN stores s ON st.store_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    LEFT JOIN price_adjustments pa ON st.adjustment_id = pa.id
    LEFT JOIN price_adjustment_items pai ON e.adjustment_item_id = pai.id
    LEFT JOIN products p ON pai.product_id = p.id
    WHERE e.id = ?
  `, [id]);

  if (!exception) {
    return res.status(404).json({ error: '异常不存在' });
  }

  res.json(exception);
});

router.get('/statistics', (req, res) => {
  const { regionId } = req.query;
  
  let whereClause = '1=1';
  const params = [];

  if (regionId) {
    whereClause = 's.region_id = ?';
    params.push(regionId);
  }

  const byType = db.all(`
    SELECT e.type, COUNT(*) as count
    FROM exceptions e
    LEFT JOIN store_tasks st ON e.store_task_id = st.id
    LEFT JOIN stores s ON st.store_id = s.id
    WHERE e.status = 'open' AND ${whereClause}
    GROUP BY e.type
  `, params);

  const byStatus = db.all(`
    SELECT e.status, COUNT(*) as count
    FROM exceptions e
    LEFT JOIN store_tasks st ON e.store_task_id = st.id
    LEFT JOIN stores s ON st.store_id = s.id
    WHERE ${whereClause}
    GROUP BY e.status
  `, params);

  res.json({ byType, byStatus });
});

router.put('/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { resolvedBy, resolution } = req.body;

  if (!resolvedBy || !resolution) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const exception = db.get('SELECT * FROM exceptions WHERE id = ?', [id]);
    if (!exception) {
      throw new Error('异常不存在');
    }

    if (exception.status !== 'open') {
      throw new Error('异常已处理');
    }

    const now = new Date().toISOString();
    
    db.run(`
      UPDATE exceptions 
      SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution = ?
      WHERE id = ?
    `, [resolvedBy, now, resolution, id]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

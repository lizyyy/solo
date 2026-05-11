const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const db = require('../database');
const businessRules = require('../services/businessRules');

router.get('/', (req, res) => {
  const { status, storeId, regionId, adjustmentId } = req.query;
  
  let whereClause = '1=1';
  const params = [];

  if (status) {
    whereClause += ' AND st.status = ?';
    params.push(status);
  }

  if (storeId) {
    whereClause += ' AND st.store_id = ?';
    params.push(storeId);
  }

  if (adjustmentId) {
    whereClause += ' AND st.adjustment_id = ?';
    params.push(adjustmentId);
  }

  let regionFilter = '';
  let regionParams = [];
  if (regionId) {
    regionFilter = 'AND s.region_id = ?';
    regionParams.push(regionId);
  }

  const tasks = db.all(`
    SELECT st.*, s.name as store_name, s.code as store_code, s.region_id, r.name as region_name,
      pa.adjustment_no, pa.title as adjustment_title, pa.effect_time, pa.type as adjustment_type,
      (SELECT COUNT(*) FROM task_items WHERE store_task_id = st.id) as total_items,
      (SELECT COUNT(*) FROM task_items WHERE store_task_id = st.id AND status = 'confirmed') as confirmed_items
    FROM store_tasks st
    JOIN stores s ON st.store_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    JOIN price_adjustments pa ON st.adjustment_id = pa.id
    WHERE ${whereClause} ${regionFilter}
    ORDER BY pa.effect_time ASC, st.created_at DESC
  `, [...params, ...regionParams]);

  res.json(tasks);
});

router.get('/dashboard', (req, res) => {
  const totalTasks = db.get('SELECT COUNT(*) as count FROM store_tasks');
  const pendingTasks = db.get("SELECT COUNT(*) as count FROM store_tasks WHERE status = 'pending'");
  const confirmedTasks = db.get("SELECT COUNT(*) as count FROM store_tasks WHERE status = 'confirmed'");
  const partialConfirmed = db.get("SELECT COUNT(*) as count FROM store_tasks WHERE status = 'partial_confirmed'");
  const hasException = db.get("SELECT COUNT(*) as count FROM store_tasks WHERE status = 'has_exception'");
  const openExceptions = db.get("SELECT COUNT(*) as count FROM exceptions WHERE status = 'open'");
  
  const regionStats = db.all(`
    SELECT r.id, r.name, r.code,
      COUNT(DISTINCT st.id) as total_tasks,
      COUNT(DISTINCT CASE WHEN st.status = 'pending' THEN st.id END) as pending,
      COUNT(DISTINCT CASE WHEN st.status = 'partial_confirmed' THEN st.id END) as partial_confirmed,
      COUNT(DISTINCT CASE WHEN st.status = 'confirmed' THEN st.id END) as confirmed,
      COUNT(DISTINCT CASE WHEN st.status = 'has_exception' THEN st.id END) as has_exception,
      COUNT(DISTINCT CASE WHEN e.status = 'open' THEN e.id END) as open_exceptions
    FROM regions r
    LEFT JOIN stores s ON r.id = s.region_id
    LEFT JOIN store_tasks st ON s.id = st.store_id
    LEFT JOIN exceptions e ON st.id = e.store_task_id
    GROUP BY r.id
    ORDER BY r.name
  `);

  const pendingStores = db.all(`
    SELECT st.id, s.name as store_name, s.code as store_code, r.name as region_name,
      pa.adjustment_no, pa.title as adjustment_title, pa.effect_time,
      (SELECT COUNT(*) FROM task_items WHERE store_task_id = st.id) as total_items
    FROM store_tasks st
    JOIN stores s ON st.store_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    JOIN price_adjustments pa ON st.adjustment_id = pa.id
    WHERE st.status = 'pending'
    ORDER BY pa.effect_time ASC
    LIMIT 20
  `);

  const exceptionOverview = db.all(`
    SELECT e.type, COUNT(*) as count
    FROM exceptions e
    WHERE e.status = 'open'
    GROUP BY e.type
  `);

  res.json({
    totalTasks: totalTasks.count,
    pendingTasks: pendingTasks.count,
    confirmedTasks: confirmedTasks.count,
    openExceptions: openExceptions.count,
    regionStats,
    pendingStores,
    exceptionOverview
  });
});

router.get('/dashboard/summary', (req, res) => {
  const summary = db.get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'partial_confirmed' THEN 1 ELSE 0 END) as partial_confirmed,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'has_exception' THEN 1 ELSE 0 END) as has_exception
    FROM store_tasks
  `);

  const byRegion = db.all(`
    SELECT r.id, r.name, r.code,
      COUNT(DISTINCT st.id) as total_tasks,
      COUNT(DISTINCT CASE WHEN st.status = 'pending' THEN st.id END) as pending,
      COUNT(DISTINCT CASE WHEN st.status = 'partial_confirmed' THEN st.id END) as partial_confirmed,
      COUNT(DISTINCT CASE WHEN st.status = 'confirmed' THEN st.id END) as confirmed,
      COUNT(DISTINCT CASE WHEN st.status = 'has_exception' THEN st.id END) as has_exception
    FROM regions r
    LEFT JOIN stores s ON r.id = s.region_id
    LEFT JOIN store_tasks st ON s.id = st.store_id
    GROUP BY r.id
    ORDER BY r.name
  `);

  res.json({
    summary,
    byRegion
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const task = db.get(`
    SELECT st.*, s.name as store_name, s.code as store_code, s.region_id, r.name as region_name,
      pa.adjustment_no, pa.title as adjustment_title, pa.effect_time, pa.type as adjustment_type, pa.description as adjustment_description
    FROM store_tasks st
    JOIN stores s ON st.store_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    JOIN price_adjustments pa ON st.adjustment_id = pa.id
    WHERE st.id = ?
  `, [id]);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  const items = db.all(`
    SELECT ti.*, pai.original_price, pai.new_price, p.sku, p.name as product_name, p.category, p.unit
    FROM task_items ti
    JOIN price_adjustment_items pai ON ti.adjustment_item_id = pai.id
    JOIN products p ON pai.product_id = p.id
    WHERE ti.store_task_id = ?
  `, [id]);

  const exceptions = db.all(`
    SELECT e.*, u.name as reporter_name
    FROM exceptions e
    LEFT JOIN users u ON e.reported_by = u.id
    WHERE e.store_task_id = ?
    ORDER BY e.created_at DESC
  `, [id]);

  res.json({ ...task, items, exceptions });
});

router.post('/:id/confirm', (req, res) => {
  const { id } = req.params;
  const { confirmedBy, itemIds } = req.body;

  try {
    const task = db.get('SELECT * FROM store_tasks WHERE id = ?', [id]);
    if (!task) {
      throw new Error('任务不存在');
    }

    const adjustment = db.get('SELECT effect_time, status FROM price_adjustments WHERE id = ?', [task.adjustment_id]);
    
    if (adjustment.status !== 'published') {
      throw new Error('调价单未发布，不能确认换签');
    }

    businessRules.checkEffectTime(adjustment.effect_time);

    const itemsToConfirm = db.all(`
      SELECT id FROM task_items 
      WHERE store_task_id = ? ${itemIds && itemIds.length ? 'AND id IN (' + itemIds.map(() => '?').join(',') + ')' : ''}
    `, itemIds && itemIds.length ? [id, ...itemIds] : [id]);

    const now = new Date().toISOString();
    
    if (itemIds && itemIds.length) {
      for (const item of itemsToConfirm) {
        db.run(`
          UPDATE task_items SET status = 'confirmed', confirmed_at = ?, note = ?
          WHERE id = ?
        `, [now, '部分确认换签', item.id]);
      }

      const allItems = db.all('SELECT id, status FROM task_items WHERE store_task_id = ?', [id]);
      const allConfirmed = allItems.every(item => item.status === 'confirmed');
      
      db.run(`
        UPDATE store_tasks 
        SET status = ?, confirmed_by = ?, confirmed_at = ?, updated_at = ?
        WHERE id = ?
      `, [allConfirmed ? 'confirmed' : 'partial_confirmed', confirmedBy, now, now, id]);
    } else {
      db.run(`
        UPDATE task_items SET status = 'confirmed', confirmed_at = ?, note = ?
        WHERE store_task_id = ?
      `, [now, '全部确认换签', id]);

      db.run(`
        UPDATE store_tasks 
        SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, updated_at = ?
        WHERE id = ?
      `, [confirmedBy, now, now, id]);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/exceptions', (req, res) => {
  const { id } = req.params;
  const { type, description, adjustmentItemId, reportedBy } = req.body;

  if (!type || !description || !reportedBy) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const exceptionId = uuidv4();
    
    db.run(`
      INSERT INTO exceptions (id, store_task_id, adjustment_item_id, type, description, reported_by, status)
      VALUES (?, ?, ?, ?, ?, ?, 'open')
    `, [exceptionId, id, adjustmentItemId || null, type, description, reportedBy]);

    res.json({ id: exceptionId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/export/price-differences', (req, res) => {
  const { status, regionId, storeId } = req.query;
  
  let whereClause = "ti.status != 'confirmed'";
  const params = [];

  if (regionId) {
    whereClause += ' AND s.region_id = ?';
    params.push(regionId);
  }

  if (storeId) {
    whereClause += ' AND st.store_id = ?';
    params.push(storeId);
  }

  const differences = db.all(`
    SELECT 
      r.name as region_name,
      s.name as store_name,
      s.code as store_code,
      pa.adjustment_no,
      pa.title as adjustment_title,
      pa.effect_time,
      p.sku,
      p.name as product_name,
      pai.original_price,
      pai.new_price,
      (pai.new_price - pai.original_price) as price_difference,
      ti.status as task_status
    FROM task_items ti
    JOIN price_adjustment_items pai ON ti.adjustment_item_id = pai.id
    JOIN products p ON pai.product_id = p.id
    JOIN store_tasks st ON ti.store_task_id = st.id
    JOIN stores s ON st.store_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    JOIN price_adjustments pa ON st.adjustment_id = pa.id
    WHERE ${whereClause}
    ORDER BY r.name, s.name, pa.effect_time
  `, params);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(differences);
  
  XLSX.utils.book_append_sheet(workbook, worksheet, '价格差异');
  
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=price-differences.xlsx');
  res.send(buffer);
});

module.exports = router;

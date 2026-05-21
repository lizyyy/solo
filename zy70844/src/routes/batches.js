const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database');

router.post('/', async (req, res) => {
  const { location_code, batch_type, responsible_person, remark, handler } = req.body;
  if (!location_code || !batch_type) {
    return res.status(400).json({ error: 'location_code and batch_type required' });
  }
  const batch_no = 'B' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
  try {
    const result = await run(
      'INSERT INTO batches (batch_no, location_code, batch_type, status, responsible_person, remark, handler) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [batch_no, location_code, batch_type, 'pending', responsible_person || null, remark || null, handler || null]
    );
    res.json({ id: result.lastID, batch_no, location_code, batch_type, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { location_code, status, responsible_person, batch_type } = req.query;
  let sql = 'SELECT * FROM batches WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND location_code = ?'; params.push(location_code); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (responsible_person) { sql += ' AND responsible_person = ?'; params.push(responsible_person); }
  if (batch_type) { sql += ' AND batch_type = ?'; params.push(batch_type); }
  sql += ' ORDER BY created_at DESC';
  try {
    const batches = await all(sql, params);
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const inventory = await all('SELECT * FROM inventory_records WHERE batch_id = ?', [req.params.id]);
    const sales = await all('SELECT * FROM sales_records WHERE batch_id = ?', [req.params.id]);
    const replenishment = await all('SELECT * FROM replenishment_records WHERE batch_id = ?', [req.params.id]);
    const logs = await all('SELECT * FROM processing_logs WHERE batch_id = ? ORDER BY created_at DESC', [req.params.id]);
    const aliases = await all('SELECT * FROM sku_alias_detections WHERE batch_id = ?', [req.params.id]);
    res.json({ batch, inventory, sales, replenishment, logs, aliases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/process', async (req, res) => {
  const { action, reason, handler } = req.body;
  if (!action || !handler) return res.status(400).json({ error: 'action and handler required' });
  let newStatus;
  switch (action) {
    case 'approve': newStatus = 'approved'; break;
    case 'reject': newStatus = 'rejected'; break;
    case 'return': newStatus = 'returned'; break;
    default: return res.status(400).json({ error: 'Invalid action: approve, reject, return' });
  }
  try {
    await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, req.params.id]);
    await run('INSERT INTO processing_logs (batch_id, action, reason, handler) VALUES (?, ?, ?, ?)', [req.params.id, action, reason || null, handler]);
    res.json({ batch_id: req.params.id, status: newStatus, action, handler });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/return', async (req, res) => {
  const { reason, handler } = req.body;
  if (!handler) return res.status(400).json({ error: 'handler required' });
  try {
    await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['returned', req.params.id]);
    await run('INSERT INTO processing_logs (batch_id, action, reason, handler) VALUES (?, ?, ?, ?)', [req.params.id, 'return', reason || null, handler]);
    res.json({ batch_id: req.params.id, status: 'returned', reason, handler });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/process', async (req, res) => {
  const { action, reason, handler } = req.body;
  
  if (!action || !handler) {
    return res.status(400).json({ error: 'action 和 handler 为必填项' });
  }
  
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    let newStatus;
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'return':
        newStatus = 'returned';
        break;
      default:
        return res.status(400).json({ error: '无效的 action，支持: approve, reject, return' });
    }
    
    await run(
      `UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStatus, req.params.id]
    );
    
    await run(
      `INSERT INTO processing_logs (batch_id, action, reason, handler) VALUES (?, ?, ?, ?)`,
      [req.params.id, action, reason || null, handler]
    );
    
    res.json({
      batch_id: req.params.id,
      status: newStatus,
      action,
      handler
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/return', async (req, res) => {
  const { reason, handler } = req.body;
  
  if (!handler) {
    return res.status(400).json({ error: 'handler 为必填项' });
  }
  
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    await run(
      `UPDATE batches SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    
    await run(
      `INSERT INTO processing_logs (batch_id, action, reason, handler) VALUES (?, 'return', ?, ?)`,
      [req.params.id, reason || null, handler]
    );
    
    res.json({
      batch_id: req.params.id,
      status: 'returned',
      reason,
      handler
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
    return res.status(400).json({ error: 'action 和 handler 为必填项' });
  }
  
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  let newStatus;
  switch (action) {
    case 'approve':
      newStatus = 'approved';
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'return':
      newStatus = 'returned';
      break;
    default:
      return res.status(400).json({ error: '无效的 action，支持: approve, reject, return' });
  }
  
  const updateStmt = db.prepare(`
    UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);
  updateStmt.run(newStatus, req.params.id);
  
  const logStmt = db.prepare(`
    INSERT INTO processing_logs (batch_id, action, reason, handler)
    VALUES (?, ?, ?, ?)
  `);
  logStmt.run(req.params.id, action, reason || null, handler);
  
  res.json({
    batch_id: req.params.id,
    status: newStatus,
    action,
    handler
  });
});

router.post('/:id/return', (req, res) => {
  const { reason, handler } = req.body;
  
  if (!handler) {
    return res.status(400).json({ error: 'handler 为必填项' });
  }
  
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  const updateStmt = db.prepare(`
    UPDATE batches SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);
  updateStmt.run(req.params.id);
  
  const logStmt = db.prepare(`
    INSERT INTO processing_logs (batch_id, action, reason, handler)
    VALUES (?, 'return', ?, ?)
  `);
  logStmt.run(req.params.id, reason || null, handler);
  
  res.json({
    batch_id: req.params.id,
    status: 'returned',
    reason,
    handler
  });
});

module.exports = router;

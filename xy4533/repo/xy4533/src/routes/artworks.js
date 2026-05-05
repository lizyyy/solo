const express = require('express');
const router = express.Router();
const db = require('../database/database');
const violationChecker = require('../services/violationChecker');

router.get('/', async (req, res) => {
  try {
    const { status, order_number } = req.query;
    
    let sql = 'SELECT * FROM artworks WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (order_number) {
      sql += ' AND order_number LIKE ?';
      params.push(`%${order_number}%`);
    }
    sql += ' ORDER BY created_at DESC';
    
    const artworks = await db.all(sql, params);
    res.json({ success: true, data: artworks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const artwork = await db.get('SELECT * FROM artworks WHERE id = ?', [req.params.id]);
    
    if (!artwork) {
      return res.status(404).json({ success: false, error: '作品不存在' });
    }
    
    const layers = await db.all(`
      SELECT * FROM layers WHERE artwork_id = ? ORDER BY layer_number
    `, [req.params.id]);
    
    const handoverNotes = await db.all(`
      SELECT * FROM handover_notes WHERE artwork_id = ? ORDER BY handover_date DESC
    `, [req.params.id]);
    
    const violations = await db.all(`
      SELECT * FROM violations WHERE artwork_id = ? ORDER BY detected_at DESC
    `, [req.params.id]);
    
    res.json({
      success: true,
      data: {
        ...artwork,
        layers,
        handover_notes: handoverNotes,
        violations
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { order_number, client_name, artwork_name, type, description, start_date, expected_completion_date } = req.body;
    
    if (!order_number || !artwork_name) {
      return res.status(400).json({ success: false, error: '订单号和作品名称为必填项' });
    }
    
    const existing = await db.get('SELECT id FROM artworks WHERE order_number = ?', [order_number]);
    if (existing) {
      return res.status(400).json({ success: false, error: '订单号已存在' });
    }
    
    const result = await db.run(`
      INSERT INTO artworks 
      (order_number, client_name, artwork_name, type, description, start_date, expected_completion_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [order_number, client_name, artwork_name, type, description, start_date, expected_completion_date]);
    
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { client_name, artwork_name, type, description, start_date, expected_completion_date, status } = req.body;
    
    const existing = await db.get('SELECT id FROM artworks WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '作品不存在' });
    }
    
    const updates = [];
    const values = [];
    
    if (client_name !== undefined) { updates.push('client_name = ?'); values.push(client_name); }
    if (artwork_name !== undefined) { updates.push('artwork_name = ?'); values.push(artwork_name); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (start_date !== undefined) { updates.push('start_date = ?'); values.push(start_date); }
    if (expected_completion_date !== undefined) { updates.push('expected_completion_date = ?'); values.push(expected_completion_date); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);
    
    await db.run(`UPDATE artworks SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM artworks WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '作品不存在' });
    }
    
    await db.run('DELETE FROM violations WHERE artwork_id = ?', [req.params.id]);
    await db.run('DELETE FROM handover_notes WHERE artwork_id = ?', [req.params.id]);
    
    const layers = await db.all('SELECT id FROM layers WHERE artwork_id = ?', [req.params.id]);
    for (const layer of layers) {
      await db.run('DELETE FROM reviews WHERE layer_id = ?', [layer.id]);
      await db.run('DELETE FROM processes WHERE layer_id = ?', [layer.id]);
    }
    await db.run('DELETE FROM layers WHERE artwork_id = ?', [req.params.id]);
    
    await db.run('DELETE FROM artworks WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

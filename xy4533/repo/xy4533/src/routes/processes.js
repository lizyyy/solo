const express = require('express');
const router = express.Router();
const db = require('../database/database');

router.get('/', async (req, res) => {
  try {
    const { layer_id, process_type, status } = req.query;
    
    let sql = 'SELECT * FROM processes WHERE 1=1';
    const params = [];
    
    if (layer_id) {
      sql += ' AND layer_id = ?';
      params.push(layer_id);
    }
    if (process_type) {
      sql += ' AND process_type = ?';
      params.push(process_type);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY start_time';
    
    const processes = await db.all(sql, params);
    res.json({ success: true, data: processes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const process = await db.get('SELECT * FROM processes WHERE id = ?', [req.params.id]);
    
    if (!process) {
      return res.status(404).json({ success: false, error: '工序不存在' });
    }
    
    res.json({ success: true, data: process });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { layer_id, process_type, start_time, end_time, duration_hours, status, operator_name, notes } = req.body;
    
    if (!layer_id || !process_type) {
      return res.status(400).json({ success: false, error: '漆层ID和工序类型为必填项' });
    }
    
    const existing = await db.get(
      'SELECT id FROM processes WHERE layer_id = ? AND process_type = ?',
      [layer_id, process_type]
    );
    if (existing) {
      return res.status(400).json({ success: false, error: '该漆层的该工序已存在' });
    }
    
    const result = await db.run(`
      INSERT INTO processes 
      (layer_id, process_type, start_time, end_time, duration_hours, status, operator_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [layer_id, process_type, start_time, end_time, duration_hours, status || 'pending', operator_name, notes]);
    
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { start_time, end_time, duration_hours, status, operator_name, notes } = req.body;
    
    const existing = await db.get('SELECT id FROM processes WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '工序不存在' });
    }
    
    const updates = [];
    const values = [];
    
    if (start_time !== undefined) { updates.push('start_time = ?'); values.push(start_time); }
    if (end_time !== undefined) { updates.push('end_time = ?'); values.push(end_time); }
    if (duration_hours !== undefined) { updates.push('duration_hours = ?'); values.push(duration_hours); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (operator_name !== undefined) { updates.push('operator_name = ?'); values.push(operator_name); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);
    
    await db.run(`UPDATE processes SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

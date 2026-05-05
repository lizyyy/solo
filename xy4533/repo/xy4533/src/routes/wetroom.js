const express = require('express');
const router = express.Router();
const db = require('../database/database');

router.get('/', async (req, res) => {
  try {
    const { cabinet_id, start_time, end_time } = req.query;
    
    let sql = 'SELECT * FROM wetroom_readings WHERE 1=1';
    const params = [];
    
    if (cabinet_id) {
      sql += ' AND cabinet_id = ?';
      params.push(cabinet_id);
    }
    if (start_time) {
      sql += ' AND reading_time >= ?';
      params.push(start_time);
    }
    if (end_time) {
      sql += ' AND reading_time <= ?';
      params.push(end_time);
    }
    sql += ' ORDER BY cabinet_id, reading_time';
    
    const readings = await db.all(sql, params);
    res.json({ success: true, data: readings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const reading = await db.get('SELECT * FROM wetroom_readings WHERE id = ?', [req.params.id]);
    
    if (!reading) {
      return res.status(404).json({ success: false, error: '读数不存在' });
    }
    
    res.json({ success: true, data: reading });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { cabinet_id, reading_time, temperature, humidity, recorded_by, notes } = req.body;
    
    if (!cabinet_id || !reading_time || temperature === undefined || humidity === undefined) {
      return res.status(400).json({ success: false, error: '柜号、读数时间、温度和湿度为必填项' });
    }
    
    const existing = await db.get(
      'SELECT id FROM wetroom_readings WHERE cabinet_id = ? AND reading_time = ?',
      [cabinet_id, reading_time]
    );
    if (existing) {
      return res.status(400).json({ success: false, error: '该柜号的该时间读数已存在' });
    }
    
    const result = await db.run(`
      INSERT INTO wetroom_readings 
      (cabinet_id, reading_time, temperature, humidity, recorded_by, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cabinet_id, reading_time, temperature, humidity, recorded_by, notes]);
    
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { temperature, humidity, recorded_by, notes } = req.body;
    
    const existing = await db.get('SELECT id FROM wetroom_readings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '读数不存在' });
    }
    
    const updates = [];
    const values = [];
    
    if (temperature !== undefined) { updates.push('temperature = ?'); values.push(temperature); }
    if (humidity !== undefined) { updates.push('humidity = ?'); values.push(humidity); }
    if (recorded_by !== undefined) { updates.push('recorded_by = ?'); values.push(recorded_by); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }
    
    values.push(req.params.id);
    
    await db.run(`UPDATE wetroom_readings SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

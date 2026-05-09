const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/init');

const router = express.Router();

router.post('/', (req, res) => {
  const { code, name, location } = req.body;
  
  if (!code || !name) {
    return res.status(400).json({
      success: false,
      error: '电表编码和名称不能为空'
    });
  }
  
  try {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO meters (id, code, name, location)
      VALUES (?, ?, ?, ?)
    `).run(id, code, name, location);
    
    const meter = db.prepare('SELECT * FROM meters WHERE id = ?').get(id);
    res.json({ success: true, data: meter });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({
        success: false,
        error: `电表编码 ${code} 已存在`
      });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/', (req, res) => {
  const meters = db.prepare('SELECT * FROM meters ORDER BY created_at DESC').all();
  res.json({ success: true, data: meters });
});

router.get('/:id/readings', (req, res) => {
  const { id } = req.params;
  
  const readings = db.prepare(`
    SELECT * FROM meter_readings 
    WHERE meter_id = ? 
    ORDER BY period DESC
  `).all(id);
  
  res.json({ success: true, data: readings });
});

router.post('/:id/readings', (req, res) => {
  const { id } = req.params;
  const { period, reading, last_reading, consumption, reading_time } = req.body;
  
  if (!period || reading == null || !reading_time) {
    return res.status(400).json({
      success: false,
      error: '周期、读数和抄表时间不能为空'
    });
  }
  
  try {
    const readId = uuidv4();
    db.prepare(`
      INSERT INTO meter_readings 
        (id, meter_id, period, reading, last_reading, consumption, reading_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(readId, id, period, reading, last_reading, consumption, reading_time);
    
    const saved = db.prepare('SELECT * FROM meter_readings WHERE id = ?').get(readId);
    res.json({ success: true, data: saved });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({
        success: false,
        error: `该电表在 ${period} 的读数已录入`
      });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

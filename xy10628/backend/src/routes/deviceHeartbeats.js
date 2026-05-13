const express = require('express');
const router = express.Router();
const { run, get, all, uuidv4 } = require('../database');

const logOperation = async (operator, action, module, recordId, details) => {
  await run(
    'INSERT INTO operation_logs (id, operator, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), operator, action, module, recordId, JSON.stringify(details)]
  );
};

router.get('/', async (req, res) => {
  try {
    const { device_id, status } = req.query;
    let sql = 'SELECT * FROM device_heartbeats WHERE 1=1';
    const params = [];
    
    if (device_id) {
      sql += ' AND device_id = ?';
      params.push(device_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    
    const heartbeats = await all(sql, params);
    res.json(heartbeats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const heartbeat = await get('SELECT * FROM device_heartbeats WHERE id = ?', [req.params.id]);
    if (!heartbeat) {
      return res.status(404).json({ error: 'Heartbeat not found' });
    }
    res.json(heartbeat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { device_id, device_name, status, voltage, current, temperature, operator = 'system' } = req.body;
    const id = uuidv4();
    
    await run(
      'INSERT INTO device_heartbeats (id, device_id, device_name, status, voltage, current, temperature) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, device_id, device_name, status, voltage, current, temperature]
    );
    
    await logOperation(operator, 'create', 'device_heartbeat', id, { device_id, status });
    
    const heartbeat = await get('SELECT * FROM device_heartbeats WHERE id = ?', [id]);
    res.status(201).json(heartbeat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, voltage, current, temperature, operator = 'system' } = req.body;
    
    const existing = await get('SELECT * FROM device_heartbeats WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Heartbeat not found' });
    }
    
    await run(
      'UPDATE device_heartbeats SET status = ?, voltage = ?, current = ?, temperature = ?, previous_status = ?, previous_voltage = ?, previous_current = ?, previous_temperature = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, voltage, current, temperature, existing.status, existing.voltage, existing.current, existing.temperature, req.params.id]
    );
    
    await logOperation(operator, 'update', 'device_heartbeat', req.params.id, {
      before: { status: existing.status, voltage: existing.voltage, current: existing.current, temperature: existing.temperature },
      after: { status, voltage, current, temperature }
    });
    
    const heartbeat = await get('SELECT * FROM device_heartbeats WHERE id = ?', [req.params.id]);
    res.json(heartbeat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

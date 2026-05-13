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
    let sql = 'SELECT * FROM remote_restarts WHERE 1=1';
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
    
    const restarts = await all(sql, params);
    res.json(restarts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const restart = await get('SELECT * FROM remote_restarts WHERE id = ?', [req.params.id]);
    if (!restart) {
      return res.status(404).json({ error: 'Restart record not found' });
    }
    res.json(restart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { device_id, operator, reason, status = 'pending' } = req.body;
    const id = uuidv4();
    
    await run(
      'INSERT INTO remote_restarts (id, device_id, operator, reason, status) VALUES (?, ?, ?, ?, ?)',
      [id, device_id, operator, reason, status]
    );
    
    await logOperation(operator, 'create', 'remote_restart', id, { device_id, reason, status });
    
    const restart = await get('SELECT * FROM remote_restarts WHERE id = ?', [id]);
    res.status(201).json(restart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, restart_time, operator = 'system' } = req.body;
    
    const existing = await get('SELECT * FROM remote_restarts WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Restart record not found' });
    }
    
    await run(
      'UPDATE remote_restarts SET status = ?, restart_time = ?, previous_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, restart_time, existing.status, req.params.id]
    );
    
    await logOperation(operator, 'update', 'remote_restart', req.params.id, {
      before: { status: existing.status },
      after: { status, restart_time }
    });
    
    const restart = await get('SELECT * FROM remote_restarts WHERE id = ?', [req.params.id]);
    res.json(restart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

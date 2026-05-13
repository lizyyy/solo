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
    const { order_id, status } = req.query;
    let sql = 'SELECT * FROM payment_failures WHERE 1=1';
    const params = [];
    
    if (order_id) {
      sql += ' AND order_id = ?';
      params.push(order_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    
    const failures = await all(sql, params);
    res.json(failures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const failure = await get('SELECT * FROM payment_failures WHERE id = ?', [req.params.id]);
    if (!failure) {
      return res.status(404).json({ error: 'Payment failure not found' });
    }
    res.json(failure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { order_id, failure_code, failure_reason, status = 'failed', operator = 'system' } = req.body;
    const id = uuidv4();
    
    await run(
      'INSERT INTO payment_failures (id, order_id, failure_code, failure_reason, status) VALUES (?, ?, ?, ?, ?)',
      [id, order_id, failure_code, failure_reason, status]
    );
    
    await logOperation(operator, 'create', 'payment_failure', id, { order_id, failure_code, status });
    
    const failure = await get('SELECT * FROM payment_failures WHERE id = ?', [id]);
    res.status(201).json(failure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/retry', async (req, res) => {
  try {
    const { status, operator = 'system' } = req.body;
    
    const existing = await get('SELECT * FROM payment_failures WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Payment failure not found' });
    }
    
    await run(
      'UPDATE payment_failures SET status = ?, retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.params.id]
    );
    
    await logOperation(operator, 'retry', 'payment_failure', req.params.id, {
      before: { status: existing.status, retry_count: existing.retry_count },
      after: { status, retry_count: existing.retry_count + 1 }
    });
    
    const failure = await get('SELECT * FROM payment_failures WHERE id = ?', [req.params.id]);
    res.json(failure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

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
    const { order_id, ticket_id, status, operator } = req.query;
    let sql = 'SELECT * FROM refund_progress WHERE 1=1';
    const params = [];
    
    if (order_id) {
      sql += ' AND order_id = ?';
      params.push(order_id);
    }
    if (ticket_id) {
      sql += ' AND ticket_id = ?';
      params.push(ticket_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (operator) {
      sql += ' AND operator = ?';
      params.push(operator);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    
    const refunds = await all(sql, params);
    res.json(refunds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const refund = await get('SELECT * FROM refund_progress WHERE id = ?', [req.params.id]);
    if (!refund) {
      return res.status(404).json({ error: 'Refund not found' });
    }
    res.json(refund);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { refund_no, order_id, ticket_id, amount, reason, status = 'pending', operator, idempotency_key } = req.body;
    
    if (idempotency_key) {
      const existing = await get('SELECT * FROM refund_progress WHERE idempotency_key = ?', [idempotency_key]);
      if (existing) {
        return res.status(200).json(existing);
      }
    }
    
    const id = uuidv4();
    
    await run(
      'INSERT INTO refund_progress (id, refund_no, order_id, ticket_id, amount, reason, status, operator, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, refund_no, order_id, ticket_id, amount, reason, status, operator, idempotency_key || id]
    );
    
    await logOperation(operator, 'create', 'refund', id, { refund_no, amount, status });
    
    const refund = await get('SELECT * FROM refund_progress WHERE id = ?', [id]);
    res.status(201).json(refund);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/review', async (req, res) => {
  try {
    const { status, reviewer, operator } = req.body;
    
    const existing = await get('SELECT * FROM refund_progress WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Refund not found' });
    }
    
    await run(
      'UPDATE refund_progress SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, reviewer, req.params.id]
    );
    
    await logOperation(operator, 'review', 'refund', req.params.id, {
      before: { status: existing.status },
      after: { status, reviewer }
    });
    
    const refund = await get('SELECT * FROM refund_progress WHERE id = ?', [req.params.id]);
    res.json(refund);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

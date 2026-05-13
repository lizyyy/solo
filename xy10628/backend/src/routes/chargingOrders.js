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
    const { device_id, status, payment_status } = req.query;
    let sql = 'SELECT * FROM charging_orders WHERE 1=1';
    const params = [];
    
    if (device_id) {
      sql += ' AND device_id = ?';
      params.push(device_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (payment_status) {
      sql += ' AND payment_status = ?';
      params.push(payment_status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    
    const orders = await all(sql, params);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await get('SELECT * FROM charging_orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { order_no, device_id, user_id, start_time, end_time, charged_kwh, amount, status, payment_status, operator = 'system' } = req.body;
    const id = uuidv4();
    
    await run(
      'INSERT INTO charging_orders (id, order_no, device_id, user_id, start_time, end_time, charged_kwh, amount, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, order_no, device_id, user_id, start_time, end_time, charged_kwh, amount, status, payment_status]
    );
    
    await logOperation(operator, 'create', 'charging_order', id, { order_no, status, amount });
    
    const order = await get('SELECT * FROM charging_orders WHERE id = ?', [id]);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, amount, payment_status, operator = 'system' } = req.body;
    
    const existing = await get('SELECT * FROM charging_orders WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    await run(
      'UPDATE charging_orders SET status = ?, amount = ?, payment_status = ?, previous_status = ?, previous_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, amount, payment_status, existing.status, existing.amount, req.params.id]
    );
    
    await logOperation(operator, 'update', 'charging_order', req.params.id, {
      before: { status: existing.status, amount: existing.amount, payment_status: existing.payment_status },
      after: { status, amount, payment_status }
    });
    
    const order = await get('SELECT * FROM charging_orders WHERE id = ?', [req.params.id]);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function logOperation(operationType, targetType, targetId, operator, details, oldValue = null, newValue = null) {
  const now = new Date().toISOString();
  return runAsync(
    `INSERT INTO operation_logs (operation_type, target_type, target_id, operator, details, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [operationType, targetType, targetId, operator, details, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, now]
  );
}

router.get('/', async (req, res) => {
  try {
    const payments = await allAsync('SELECT * FROM payment_progress ORDER BY created_at DESC');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await getAsync('SELECT * FROM payment_progress WHERE id = ?', [req.params.id]);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { activity_id, request_id, amount, payment_method, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    const existingPayment = await getAsync('SELECT * FROM payment_progress WHERE request_id = ?', [request_id]);
    if (existingPayment) {
      return res.status(200).json({
        ...existingPayment,
        message: '支付请求已存在，返回原有记录（幂等性保证）'
      });
    }

    await runAsync(
      `INSERT INTO payment_progress (id, activity_id, request_id, amount, status, payment_method, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, activity_id, request_id, amount, payment_method, created_by, now, now]
    );

    await logOperation('create', 'payment', id, created_by, `创建支付请求: ${request_id}, 金额: ${amount}`);

    const payment = await getAsync('SELECT * FROM payment_progress WHERE id = ?', [id]);
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status, transaction_id, operator } = req.body;
  const now = new Date().toISOString();

  try {
    const oldPayment = await getAsync('SELECT * FROM payment_progress WHERE id = ?', [req.params.id]);
    if (!oldPayment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const updateParams = [status, now, req.params.id];
    let updateSql = `UPDATE payment_progress SET status = ?, updated_at = ?`;
    
    if (transaction_id) {
      updateSql += `, transaction_id = ?, paid_at = ?`;
      updateParams.splice(2, 0, transaction_id, now);
    }
    
    updateSql += ` WHERE id = ?`;

    await runAsync(updateSql, updateParams);

    const newPayment = await getAsync('SELECT * FROM payment_progress WHERE id = ?', [req.params.id]);

    await logOperation('status_change', 'payment', req.params.id, operator, `支付状态变更为: ${status}`, { status: oldPayment.status }, { status: status });

    res.json(newPayment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

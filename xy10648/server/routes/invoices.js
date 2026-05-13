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
    const invoices = await allAsync('SELECT * FROM invoice_reviews ORDER BY created_at DESC');
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await getAsync('SELECT * FROM invoice_reviews WHERE id = ?', [req.params.id]);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { activity_id, invoice_number, invoice_amount, invoice_date, vendor_name, invoice_url, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    await runAsync(
      `INSERT INTO invoice_reviews (id, activity_id, invoice_number, invoice_amount, invoice_date, vendor_name, invoice_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, activity_id, invoice_number, invoice_amount, invoice_date, vendor_name, invoice_url, now, now]
    );

    await logOperation('create', 'invoice', id, created_by, `提交票据审核: ${invoice_number}`);

    const invoice = await getAsync('SELECT * FROM invoice_reviews WHERE id = ?', [id]);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status, reviewer, review_comment } = req.body;
  const now = new Date().toISOString();

  try {
    const oldInvoice = await getAsync('SELECT * FROM invoice_reviews WHERE id = ?', [req.params.id]);
    if (!oldInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await runAsync(
      `UPDATE invoice_reviews SET status = ?, reviewer = ?, review_comment = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
      [status, reviewer, review_comment, now, now, req.params.id]
    );

    const newInvoice = await getAsync('SELECT * FROM invoice_reviews WHERE id = ?', [req.params.id]);

    await logOperation('status_change', 'invoice', req.params.id, reviewer, `票据审核状态变更为: ${status}, 备注: ${review_comment || ''}`, { status: oldInvoice.status }, { status: status });

    res.json(newInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/supplements', async (req, res) => {
  try {
    const supplements = await allAsync('SELECT * FROM supplement_requests WHERE review_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(supplements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

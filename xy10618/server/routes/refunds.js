const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM refund_trials ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/calculate', (req, res) => {
  const { package_id, refund_reason } = req.body;

  db.get('SELECT * FROM member_packages WHERE id = ?', [package_id], (err, pkg) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!pkg) {
      return res.status(404).json({ error: '课包不存在' });
    }

    const classes_used = pkg.total_classes - pkg.remaining_classes;
    const price_per_class = pkg.price / pkg.total_classes;
    const refund_amount = pkg.remaining_classes * price_per_class * 0.9;
    const deduction_amount = pkg.price - refund_amount;

    res.json({
      package_id,
      member_id: pkg.member_id,
      member_name: pkg.member_name,
      refund_reason,
      classes_used,
      classes_remaining: pkg.remaining_classes,
      original_price: pkg.price,
      refund_amount: Math.round(refund_amount * 100) / 100,
      deduction_amount: Math.round(deduction_amount * 100) / 100
    });
  });
});

router.post('/', (req, res) => {
  const { package_id, member_id, member_name, refund_reason, classes_used, classes_remaining, original_price, refund_amount, deduction_amount, operator_id, operator_name } = req.body;
  const id = uuidv4();
  const now = moment().toISOString();

  db.run(
    `INSERT INTO refund_trials (id, package_id, member_id, member_name, refund_reason, classes_used, classes_remaining, original_price, refund_amount, deduction_amount, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, package_id, member_id, member_name, refund_reason, classes_used, classes_remaining, original_price, refund_amount, deduction_amount, 'pending', now, now],
    async (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      await logOperation('create', 'refund_trials', id, operator_id || 'A001', operator_name || '管理员', null, req.body, '申请退款');

      db.get('SELECT * FROM refund_trials WHERE id = ?', [id], (err, row) => {
        res.status(201).json(row);
      });
    }
  );
});

router.put('/:id/approve', (req, res) => {
  const id = req.params.id;
  const { operator_id, operator_name } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM refund_trials WHERE id = ?', [id], (err, refund) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!refund) return res.status(404).json({ error: '退款记录不存在' });
    if (refund.status !== 'pending') return res.status(400).json({ error: '该记录已处理' });

    const transactionId = 'TXN' + Date.now();

    db.run(
      `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), transactionId, refund.package_id, refund.member_id, refund.member_name, 'refund', -refund.refund_amount, -refund.classes_remaining, refund.original_price, 0, refund.classes_remaining, 0, `退款-${refund.refund_reason}`, operator_id || 'A001', operator_name || '管理员', id, now]
    );

    db.run('UPDATE member_packages SET remaining_classes = 0, status = "refunded", updated_at = ? WHERE id = ?', [now, refund.package_id]);

    db.run(
      'UPDATE refund_trials SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
      ['approved', operator_id || 'A001', now, now, id],
      async (err) => {
        if (err) return res.status(500).json({ error: err.message });

        await logOperation('approve', 'refund_trials', id, operator_id || 'A001', operator_name || '管理员', refund, { status: 'approved' }, '批准退款');

        db.get('SELECT * FROM refund_trials WHERE id = ?', [id], (err, row) => {
          res.json(row);
        });
      }
    );
  });
});

router.put('/:id/reject', (req, res) => {
  const id = req.params.id;
  const { operator_id, operator_name } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM refund_trials WHERE id = ?', [id], async (err, refund) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!refund) return res.status(404).json({ error: '退款记录不存在' });
    if (refund.status !== 'pending') return res.status(400).json({ error: '该记录已处理' });

    db.run(
      'UPDATE refund_trials SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
      ['rejected', operator_id || 'A001', now, now, id],
      async (err) => {
        if (err) return res.status(500).json({ error: err.message });

        await logOperation('reject', 'refund_trials', id, operator_id || 'A001', operator_name || '管理员', refund, { status: 'rejected' }, '拒绝退款');

        db.get('SELECT * FROM refund_trials WHERE id = ?', [id], (err, row) => {
          res.json(row);
        });
      }
    );
  });
});

module.exports = router;

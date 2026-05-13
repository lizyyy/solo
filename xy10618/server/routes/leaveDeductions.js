const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM leave_deductions ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { package_id, member_id, member_name, leave_date, reason, classes_deducted, operator_id, operator_name } = req.body;
  const id = uuidv4();
  const now = moment().toISOString();

  db.get('SELECT * FROM member_packages WHERE id = ? AND status = "active"', [package_id], (err, pkg) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!pkg) {
      return res.status(400).json({ error: '无效的课包' });
    }
    if (pkg.remaining_classes < classes_deducted) {
      return res.status(400).json({ error: '课包剩余课时不足' });
    }

    db.run(
      `INSERT INTO leave_deductions (id, package_id, member_id, member_name, leave_date, reason, classes_deducted, status, old_remaining, new_remaining, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, package_id, member_id, member_name, leave_date, reason, classes_deducted, 'pending', pkg.remaining_classes, pkg.remaining_classes - classes_deducted, now, now],
      async (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        await logOperation('create', 'leave_deductions', id, operator_id || 'A001', operator_name || '管理员', null, req.body, '申请请假扣课');

        db.get('SELECT * FROM leave_deductions WHERE id = ?', [id], (err, row) => {
          res.status(201).json(row);
        });
      }
    );
  });
});

router.put('/:id/approve', (req, res) => {
  const id = req.params.id;
  const { operator_id, operator_name } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM leave_deductions WHERE id = ?', [id], (err, deduction) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!deduction) {
      return res.status(404).json({ error: '扣课记录不存在' });
    }
    if (deduction.status !== 'pending') {
      return res.status(400).json({ error: '该记录已处理' });
    }

    db.get('SELECT * FROM member_packages WHERE id = ?', [deduction.package_id], (pkgErr, pkg) => {
      if (pkgErr) {
        return res.status(500).json({ error: pkgErr.message });
      }
      if (!pkg || pkg.remaining_classes < deduction.classes_deducted) {
        return res.status(400).json({ error: '课包剩余课时不足' });
      }

      const newRemaining = pkg.remaining_classes - deduction.classes_deducted;
      const pricePerClass = pkg.price / pkg.total_classes;
      const transactionId = 'TXN' + Date.now();

      db.run(
        'UPDATE member_packages SET remaining_classes = ?, updated_at = ? WHERE id = ?',
        [newRemaining, now, deduction.package_id],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
          }

          db.run(
            `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), transactionId, deduction.package_id, deduction.member_id, deduction.member_name, 'deduction', -pricePerClass * deduction.classes_deducted, -deduction.classes_deducted, pkg.price, pkg.price - pricePerClass * deduction.classes_deducted, pkg.remaining_classes, newRemaining, `请假扣课${deduction.classes_deducted}节`, operator_id || 'A001', operator_name || '管理员', id, now]
          );

          db.run(
            'UPDATE leave_deductions SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
            ['approved', operator_id || 'A001', now, now, id],
            async (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              await logOperation('approve', 'leave_deductions', id, operator_id || 'A001', operator_name || '管理员', deduction, { status: 'approved' }, '批准请假扣课');

              db.get('SELECT * FROM leave_deductions WHERE id = ?', [id], (err, row) => {
                res.json(row);
              });
            }
          );
        }
      );
    });
  });
});

router.put('/:id/reject', (req, res) => {
  const id = req.params.id;
  const { operator_id, operator_name } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM leave_deductions WHERE id = ?', [id], async (err, deduction) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!deduction) {
      return res.status(404).json({ error: '扣课记录不存在' });
    }
    if (deduction.status !== 'pending') {
      return res.status(400).json({ error: '该记录已处理' });
    }

    db.run(
      'UPDATE leave_deductions SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
      ['rejected', operator_id || 'A001', now, now, id],
      async (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        await logOperation('reject', 'leave_deductions', id, operator_id || 'A001', operator_name || '管理员', deduction, { status: 'rejected' }, '拒绝请假扣课');

        db.get('SELECT * FROM leave_deductions WHERE id = ?', [id], (err, row) => {
          res.json(row);
        });
      }
    );
  });
});

module.exports = router;

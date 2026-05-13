const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM coach_schedules ORDER BY schedule_date DESC, start_time DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { coach_id, coach_name, member_id, member_name, package_id, schedule_date, start_time, end_time, notes, operator_id, operator_name } = req.body;
  const id = uuidv4();
  const now = moment().toISOString();

  db.get('SELECT * FROM member_packages WHERE id = ? AND status = "active"', [package_id], (err, pkg) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!pkg) {
      return res.status(400).json({ error: '无效的课包或课包已失效' });
    }
    if (pkg.remaining_classes <= 0) {
      return res.status(400).json({ error: '课包剩余课时不足' });
    }

    db.run(
      `INSERT INTO coach_schedules (id, coach_id, coach_name, member_id, member_name, package_id, schedule_date, start_time, end_time, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, coach_id, coach_name, member_id, member_name, package_id, schedule_date, start_time, end_time, 'scheduled', notes || '', now, now],
      async (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        await logOperation('create', 'coach_schedules', id, operator_id || 'A001', operator_name || '管理员', null, req.body, '创建教练排班');

        db.get('SELECT * FROM coach_schedules WHERE id = ?', [id], (err, row) => {
          res.status(201).json(row);
        });
      }
    );
  });
});

router.put('/:id/status', (req, res) => {
  const id = req.params.id;
  const { status, operator_id, operator_name } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM coach_schedules WHERE id = ?', [id], async (err, oldRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!oldRow) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (status === 'completed') {
      db.get('SELECT * FROM member_packages WHERE id = ?', [oldRow.package_id], (pkgErr, pkg) => {
        if (pkgErr) {
          return res.status(500).json({ error: pkgErr.message });
        }
        if (!pkg || pkg.remaining_classes <= 0) {
          return res.status(400).json({ error: '课包剩余课时不足，无法完成消课' });
        }

        const newRemaining = pkg.remaining_classes - 1;
        const pricePerClass = pkg.price / pkg.total_classes;
        const transactionId = 'TXN' + Date.now();

        db.run(
          'UPDATE member_packages SET remaining_classes = ?, updated_at = ? WHERE id = ?',
          [newRemaining, now, oldRow.package_id],
          async (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ error: updateErr.message });
            }

            db.run(
              `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuidv4(), transactionId, oldRow.package_id, oldRow.member_id, oldRow.member_name, 'consumption', -pricePerClass, -1, pkg.price, pkg.price - pricePerClass, pkg.remaining_classes, newRemaining, `上课消课-${oldRow.coach_name}`, operator_id || 'A001', operator_name || '管理员', id, now]
            );
          }
        );
      });
    }

    db.run(
      'UPDATE coach_schedules SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id],
      async (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        await logOperation('update', 'coach_schedules', id, operator_id || 'A001', operator_name || '管理员', oldRow, { status }, `更新排班状态为:${status}`);

        db.get('SELECT * FROM coach_schedules WHERE id = ?', [id], (err, row) => {
          res.json(row);
        });
      }
    );
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM transfer_commissions ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { from_package_id, to_package_id, from_member_id, from_member_name, to_member_id, to_member_name, classes_transferred, commission_rate, operator_id, operator_name } = req.body;
  const id = uuidv4();
  const now = moment().toISOString();

  db.get('SELECT * FROM member_packages WHERE id = ? AND status = "active"', [from_package_id], (err, fromPkg) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!fromPkg) return res.status(400).json({ error: '转出课包无效' });
    if (fromPkg.remaining_classes < classes_transferred) return res.status(400).json({ error: '转出课包课时不足' });

    db.get('SELECT * FROM member_packages WHERE id = ? AND status = "active"', [to_package_id], (err, toPkg) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!toPkg) return res.status(400).json({ error: '转入课包无效' });

      const pricePerClass = fromPkg.price / fromPkg.total_classes;
      const commission_amount = pricePerClass * classes_transferred * commission_rate;

      db.run(
        `INSERT INTO transfer_commissions (id, from_package_id, to_package_id, from_member_id, from_member_name, to_member_id, to_member_name, classes_transferred, commission_rate, commission_amount, status, from_old_remaining, from_new_remaining, to_old_remaining, to_new_remaining, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, from_package_id, to_package_id, from_member_id, from_member_name, to_member_id, to_member_name, classes_transferred, commission_rate, commission_amount, 'pending', fromPkg.remaining_classes, fromPkg.remaining_classes - classes_transferred, toPkg.remaining_classes, toPkg.remaining_classes + classes_transferred, now, now],
        async (err) => {
          if (err) return res.status(500).json({ error: err.message });

          await logOperation('create', 'transfer_commissions', id, operator_id || 'A001', operator_name || '管理员', null, req.body, '申请转课');

          db.get('SELECT * FROM transfer_commissions WHERE id = ?', [id], (err, row) => {
            res.status(201).json(row);
          });
        }
      );
    });
  });
});

router.put('/:id/approve', (req, res) => {
  const id = req.params.id;
  const { operator_id, operator_name } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM transfer_commissions WHERE id = ?', [id], (err, transfer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transfer) return res.status(404).json({ error: '转课记录不存在' });
    if (transfer.status !== 'pending') return res.status(400).json({ error: '该记录已处理' });

    db.get('SELECT * FROM member_packages WHERE id = ?', [transfer.from_package_id], (err, fromPkg) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!fromPkg || fromPkg.remaining_classes < transfer.classes_transferred) {
        return res.status(400).json({ error: '转出课包课时不足' });
      }

      db.get('SELECT * FROM member_packages WHERE id = ?', [transfer.to_package_id], (err, toPkg) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!toPkg) return res.status(400).json({ error: '转入课包无效' });

        const fromNewRemaining = fromPkg.remaining_classes - transfer.classes_transferred;
        const toNewRemaining = toPkg.remaining_classes + transfer.classes_transferred;

        db.run('UPDATE member_packages SET remaining_classes = ?, updated_at = ? WHERE id = ?', [fromNewRemaining, now, transfer.from_package_id]);
        db.run('UPDATE member_packages SET remaining_classes = ?, updated_at = ? WHERE id = ?', [toNewRemaining, now, transfer.to_package_id]);

        const pricePerClass = fromPkg.price / fromPkg.total_classes;
        const transactionId = 'TXN' + Date.now();

        db.run(
          `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), transactionId + '-OUT', transfer.from_package_id, transfer.from_member_id, transfer.from_member_name, 'transfer_out', -pricePerClass * transfer.classes_transferred, -transfer.classes_transferred, fromPkg.price, fromPkg.price - pricePerClass * transfer.classes_transferred, fromPkg.remaining_classes, fromNewRemaining, `转课转出${transfer.classes_transferred}节给${transfer.to_member_name}`, operator_id || 'A001', operator_name || '管理员', id, now]
        );

        db.run(
          `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), transactionId + '-IN', transfer.to_package_id, transfer.to_member_id, transfer.to_member_name, 'transfer_in', pricePerClass * transfer.classes_transferred, transfer.classes_transferred, toPkg.price, toPkg.price + pricePerClass * transfer.classes_transferred, toPkg.remaining_classes, toNewRemaining, `转课转入${transfer.classes_transferred}节来自${transfer.from_member_name}`, operator_id || 'A001', operator_name || '管理员', id, now]
        );

        db.run(
          'UPDATE transfer_commissions SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
          ['approved', operator_id || 'A001', now, now, id],
          async (err) => {
            if (err) return res.status(500).json({ error: err.message });

            await logOperation('approve', 'transfer_commissions', id, operator_id || 'A001', operator_name || '管理员', transfer, { status: 'approved' }, '批准转课');

            db.get('SELECT * FROM transfer_commissions WHERE id = ?', [id], (err, row) => {
              res.json(row);
            });
          }
        );
      });
    });
  });
});

router.put('/:id/reject', (req, res) => {
  const id = req.params.id;
  const { operator_id, operator_name } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM transfer_commissions WHERE id = ?', [id], async (err, transfer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transfer) return res.status(404).json({ error: '转课记录不存在' });
    if (transfer.status !== 'pending') return res.status(400).json({ error: '该记录已处理' });

    db.run(
      'UPDATE transfer_commissions SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
      ['rejected', operator_id || 'A001', now, now, id],
      async (err) => {
        if (err) return res.status(500).json({ error: err.message });

        await logOperation('reject', 'transfer_commissions', id, operator_id || 'A001', operator_name || '管理员', transfer, { status: 'rejected' }, '拒绝转课');

        db.get('SELECT * FROM transfer_commissions WHERE id = ?', [id], (err, row) => {
          res.json(row);
        });
      }
    );
  });
});

module.exports = router;

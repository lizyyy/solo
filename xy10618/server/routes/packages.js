const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM member_packages ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM member_packages WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { member_id, member_name, package_name, total_classes, price, purchase_date, expire_date, operator_id, operator_name } = req.body;
  const id = uuidv4();
  const now = moment().toISOString();

  db.run(
    `INSERT INTO member_packages (id, member_id, member_name, package_name, total_classes, remaining_classes, price, purchase_date, expire_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, member_id, member_name, package_name, total_classes, total_classes, price, purchase_date || now, expire_date || moment().add(1, 'year').toISOString(), 'active', now, now],
    async (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const transactionId = 'TXN' + Date.now();
      const pricePerClass = price / total_classes;
      
      db.run(
        `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), transactionId, id, member_id, member_name, 'purchase', price, total_classes, 0, price, 0, total_classes, `购买${package_name}`, operator_id || 'A001', operator_name || '管理员', id, now],
        async (ledgerErr) => {
          if (ledgerErr) {
            console.error('Failed to create ledger entry:', ledgerErr);
          }
        }
      );

      await logOperation('create', 'member_packages', id, operator_id || 'A001', operator_name || '管理员', null, req.body, '创建会员课包');

      db.get('SELECT * FROM member_packages WHERE id = ?', [id], (err, row) => {
        res.status(201).json(row);
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { operator_id, operator_name, ...updateData } = req.body;
  const now = moment().toISOString();

  db.get('SELECT * FROM member_packages WHERE id = ?', [id], async (err, oldRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!oldRow) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const updates = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id' && key !== 'created_at') {
        updates.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    updates.push('updated_at = ?');
    values.push(now, id);

    db.run(
      `UPDATE member_packages SET ${updates.join(', ')} WHERE id = ?`,
      values,
      async (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }

        await logOperation('update', 'member_packages', id, operator_id || 'A001', operator_name || '管理员', oldRow, updateData, '更新会员课包');

        db.get('SELECT * FROM member_packages WHERE id = ?', [id], (err, row) => {
          res.json(row);
        });
      }
    );
  });
});

module.exports = router;

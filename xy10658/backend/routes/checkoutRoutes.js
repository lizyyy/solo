const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.get('/', (req, res) => {
  try {
    const checkouts = DBUtils.allQuery(`
      SELECT ci.*, lc.room_number, lc.tenant_name 
      FROM checkout_inspections ci
      LEFT JOIN lease_contracts lc ON ci.contract_id = lc.id
      ORDER BY ci.created_at DESC
    `);
    res.json(checkouts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { contract_id, inspection_date, overall_condition, notes, total_deductions, refund_amount, created_by } = req.body;
    
    const contract = DBUtils.getQuery('SELECT id FROM lease_contracts WHERE id = ?', [contract_id]);
    if (!contract) {
      return res.status(404).json({ error: 'Lease contract not found' });
    }
    
    const id = DBUtils.generateId();
    const now = DBUtils.now();
    
    DBUtils.runQuery(
      `INSERT INTO checkout_inspections (id, contract_id, inspection_date, overall_condition, notes, total_deductions, refund_amount, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contract_id, inspection_date, overall_condition, notes, total_deductions || 0, refund_amount, 'pending', now, now, created_by || 'system']
    );
    
    DBUtils.logOperation('checkout', 'create', id, null, req.body, created_by || 'system');
    
    const newCheckout = DBUtils.getQuery('SELECT * FROM checkout_inspections WHERE id = ?', [id]);
    res.status(201).json(newCheckout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/review', (req, res) => {
  try {
    const { status, reviewed_by } = req.body;
    const oldCheckout = DBUtils.getQuery('SELECT * FROM checkout_inspections WHERE id = ?', [req.params.id]);
    
    if (!oldCheckout) {
      return res.status(404).json({ error: 'Checkout inspection not found' });
    }
    
    const now = DBUtils.now();
    
    if (status === 'approved') {
      DBUtils.transaction(() => {
        DBUtils.runQuery(
          `UPDATE checkout_inspections SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
          ['approved', reviewed_by, now, now, req.params.id]
        );
        
        const checkout = DBUtils.getQuery('SELECT * FROM checkout_inspections WHERE id = ?', [req.params.id]);
        
        const lastLedger = DBUtils.getQuery(
          `SELECT balance FROM deposit_ledgers WHERE contract_id = ? ORDER BY created_at DESC LIMIT 1`,
          [checkout.contract_id]
        );
        
        const contract = DBUtils.getQuery(
          `SELECT deposit_amount FROM lease_contracts WHERE id = ?`,
          [checkout.contract_id]
        );
        
        const previousBalance = lastLedger ? lastLedger.balance : contract.deposit_amount;
        
        if (checkout.total_deductions > 0) {
          const balanceAfterDeduction = previousBalance - checkout.total_deductions;
          const ledgerId1 = DBUtils.generateId();
          DBUtils.runQuery(
            `INSERT INTO deposit_ledgers (id, contract_id, transaction_type, amount, balance, description, status, created_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ledgerId1, checkout.contract_id, 'maintenance_deduction', checkout.total_deductions, balanceAfterDeduction, '退租维修扣款合计', 'confirmed', now, reviewed_by || 'system']
          );
          
          const ledgerId2 = DBUtils.generateId();
          DBUtils.runQuery(
            `INSERT INTO deposit_ledgers (id, contract_id, transaction_type, amount, balance, description, status, created_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ledgerId2, checkout.contract_id, 'refund', checkout.refund_amount, 0, '押金退款', 'confirmed', now, reviewed_by || 'system']
          );
        } else {
          const ledgerId = DBUtils.generateId();
          DBUtils.runQuery(
            `INSERT INTO deposit_ledgers (id, contract_id, transaction_type, amount, balance, description, status, created_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ledgerId, checkout.contract_id, 'refund', previousBalance, 0, '押金全额退款', 'confirmed', now, reviewed_by || 'system']
          );
        }
        
        DBUtils.runQuery(
          `UPDATE lease_contracts SET status = ?, deposit_amount = 0, updated_at = ? WHERE id = ?`,
          ['ended', now, checkout.contract_id]
        );
      });
    } else if (status === 'rejected') {
      DBUtils.runQuery(
        `UPDATE checkout_inspections SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
        ['rejected', reviewed_by, now, now, req.params.id]
      );
    }
    
    DBUtils.logOperation('checkout', 'review', req.params.id, oldCheckout, req.body, reviewed_by || 'system');
    
    const updatedCheckout = DBUtils.getQuery('SELECT * FROM checkout_inspections WHERE id = ?', [req.params.id]);
    res.json(updatedCheckout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

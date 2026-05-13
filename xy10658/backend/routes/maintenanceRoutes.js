const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.get('/', (req, res) => {
  try {
    const maintenances = DBUtils.allQuery(`
      SELECT md.*, lc.room_number, lc.tenant_name 
      FROM maintenance_deductions md
      LEFT JOIN lease_contracts lc ON md.contract_id = lc.id
      ORDER BY md.created_at DESC
    `);
    res.json(maintenances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { contract_id, item_name, deduction_amount, reason, photos, created_by } = req.body;
    
    const contract = DBUtils.getQuery('SELECT id FROM lease_contracts WHERE id = ?', [contract_id]);
    if (!contract) {
      return res.status(404).json({ error: 'Lease contract not found' });
    }
    
    const id = DBUtils.generateId();
    const now = DBUtils.now();
    
    DBUtils.runQuery(
      `INSERT INTO maintenance_deductions (id, contract_id, item_name, deduction_amount, reason, photos, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contract_id, item_name, deduction_amount, reason, photos, 'pending', now, now, created_by || 'system']
    );
    
    DBUtils.logOperation('maintenance', 'create', id, null, req.body, created_by || 'system');
    
    const newMaintenance = DBUtils.getQuery('SELECT * FROM maintenance_deductions WHERE id = ?', [id]);
    res.status(201).json(newMaintenance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/review', (req, res) => {
  try {
    const { status, reviewed_by } = req.body;
    const oldMaintenance = DBUtils.getQuery('SELECT * FROM maintenance_deductions WHERE id = ?', [req.params.id]);
    
    if (!oldMaintenance) {
      return res.status(404).json({ error: 'Maintenance deduction not found' });
    }
    
    const now = DBUtils.now();
    
    if (status === 'approved') {
      DBUtils.transaction(() => {
        DBUtils.runQuery(
          `UPDATE maintenance_deductions SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
          ['approved', reviewed_by, now, now, req.params.id]
        );
        
        const maintenance = DBUtils.getQuery('SELECT * FROM maintenance_deductions WHERE id = ?', [req.params.id]);
        
        const lastLedger = DBUtils.getQuery(
          `SELECT balance FROM deposit_ledgers WHERE contract_id = ? ORDER BY created_at DESC LIMIT 1`,
          [maintenance.contract_id]
        );
        
        const contract = DBUtils.getQuery(
          `SELECT deposit_amount FROM lease_contracts WHERE id = ?`,
          [maintenance.contract_id]
        );
        
        const previousBalance = lastLedger ? lastLedger.balance : contract.deposit_amount;
        const newBalance = previousBalance - maintenance.deduction_amount;
        
        const ledgerId = DBUtils.generateId();
        DBUtils.runQuery(
          `INSERT INTO deposit_ledgers (id, contract_id, transaction_type, amount, balance, description, status, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledgerId, maintenance.contract_id, 'maintenance_deduction', maintenance.deduction_amount, newBalance, `维修扣款: ${maintenance.item_name}`, 'confirmed', now, reviewed_by || 'system']
        );
        
        DBUtils.runQuery(
          `UPDATE lease_contracts SET deposit_amount = ?, updated_at = ? WHERE id = ?`,
          [newBalance, now, maintenance.contract_id]
        );
      });
    } else if (status === 'rejected') {
      DBUtils.runQuery(
        `UPDATE maintenance_deductions SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
        ['rejected', reviewed_by, now, now, req.params.id]
      );
    }
    
    DBUtils.logOperation('maintenance', 'review', req.params.id, oldMaintenance, req.body, reviewed_by || 'system');
    
    const updatedMaintenance = DBUtils.getQuery('SELECT * FROM maintenance_deductions WHERE id = ?', [req.params.id]);
    res.json(updatedMaintenance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

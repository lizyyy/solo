const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.get('/', (req, res) => {
  try {
    const deposits = DBUtils.allQuery(`
      SELECT dl.*, lc.room_number, lc.tenant_name 
      FROM deposit_ledgers dl
      LEFT JOIN lease_contracts lc ON dl.contract_id = lc.id
      ORDER BY dl.created_at DESC
    `);
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/contract/:contractId', (req, res) => {
  try {
    const deposits = DBUtils.allQuery(
      `SELECT * FROM deposit_ledgers WHERE contract_id = ? ORDER BY created_at DESC`,
      [req.params.contractId]
    );
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { contract_id, transaction_type, amount, description, created_by } = req.body;
    
    const lastLedger = DBUtils.getQuery(
      `SELECT balance FROM deposit_ledgers WHERE contract_id = ? ORDER BY created_at DESC LIMIT 1`,
      [contract_id]
    );
    
    const contract = DBUtils.getQuery(
      `SELECT deposit_amount FROM lease_contracts WHERE id = ?`,
      [contract_id]
    );
    
    if (!contract) {
      return res.status(404).json({ error: 'Lease contract not found' });
    }
    
    const previousBalance = lastLedger ? lastLedger.balance : contract.deposit_amount;
    let newBalance = previousBalance;
    
    switch (transaction_type) {
      case 'deposit_increase':
        newBalance = previousBalance + amount;
        break;
      case 'deposit_decrease':
      case 'maintenance_deduction':
        newBalance = previousBalance - amount;
        break;
      case 'refund':
        newBalance = 0;
        break;
    }
    
    const id = DBUtils.generateId();
    const now = DBUtils.now();
    
    DBUtils.runQuery(
      `INSERT INTO deposit_ledgers (id, contract_id, transaction_type, amount, balance, description, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contract_id, transaction_type, amount, newBalance, description, 'confirmed', now, created_by || 'system']
    );
    
    DBUtils.logOperation('deposit', 'create', id, null, req.body, created_by || 'system');
    
    const newDeposit = DBUtils.getQuery('SELECT * FROM deposit_ledgers WHERE id = ?', [id]);
    res.status(201).json(newDeposit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.get('/', (req, res) => {
  try {
    const renewals = DBUtils.allQuery(`
      SELECT rq.*, lc.room_number, lc.tenant_name 
      FROM renewal_quotes rq
      LEFT JOIN lease_contracts lc ON rq.contract_id = lc.id
      ORDER BY rq.created_at DESC
    `);
    res.json(renewals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { contract_id, new_end_date, new_monthly_rent, deposit_adjustment, created_by } = req.body;
    
    const contract = DBUtils.getQuery('SELECT end_date FROM lease_contracts WHERE id = ?', [contract_id]);
    if (!contract) {
      return res.status(404).json({ error: 'Lease contract not found' });
    }
    
    const id = DBUtils.generateId();
    const now = DBUtils.now();
    
    DBUtils.runQuery(
      `INSERT INTO renewal_quotes (id, contract_id, original_end_date, new_end_date, new_monthly_rent, deposit_adjustment, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contract_id, contract.end_date, new_end_date, new_monthly_rent, deposit_adjustment || 0, 'pending', now, now, created_by || 'system']
    );
    
    DBUtils.logOperation('renewal', 'create', id, null, req.body, created_by || 'system');
    
    const newRenewal = DBUtils.getQuery('SELECT * FROM renewal_quotes WHERE id = ?', [id]);
    res.status(201).json(newRenewal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/review', (req, res) => {
  try {
    const { status, reviewed_by } = req.body;
    const oldRenewal = DBUtils.getQuery('SELECT * FROM renewal_quotes WHERE id = ?', [req.params.id]);
    
    if (!oldRenewal) {
      return res.status(404).json({ error: 'Renewal quote not found' });
    }
    
    const now = DBUtils.now();
    
    if (status === 'approved') {
      DBUtils.transaction(() => {
        DBUtils.runQuery(
          `UPDATE renewal_quotes SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
          ['approved', reviewed_by, now, now, req.params.id]
        );
        
        const renewal = DBUtils.getQuery('SELECT * FROM renewal_quotes WHERE id = ?', [req.params.id]);
        const oldContract = DBUtils.getQuery('SELECT * FROM lease_contracts WHERE id = ?', [renewal.contract_id]);
        
        const newContractData = {
          ...oldContract,
          end_date: renewal.new_end_date,
          monthly_rent: renewal.new_monthly_rent,
          deposit_amount: oldContract.deposit_amount + renewal.deposit_adjustment
        };
        
        DBUtils.runQuery(
          `UPDATE lease_contracts SET end_date = ?, monthly_rent = ?, deposit_amount = ?, updated_at = ? WHERE id = ?`,
          [renewal.new_end_date, renewal.new_monthly_rent, newContractData.deposit_amount, now, renewal.contract_id]
        );
        
        if (renewal.deposit_adjustment !== 0) {
          const newBalance = newContractData.deposit_amount;
          DBUtils.runQuery(
            `INSERT INTO deposit_ledgers (id, contract_id, transaction_type, amount, balance, description, status, created_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              DBUtils.generateId(),
              renewal.contract_id,
              renewal.deposit_adjustment > 0 ? 'deposit_increase' : 'deposit_decrease',
              renewal.deposit_adjustment,
              newBalance,
              '续租押金调整',
              'confirmed',
              now,
              reviewed_by || 'system'
            ]
          );
        }
        
        DBUtils.logOperation('lease', 'renewal_update', renewal.contract_id, oldContract, newContractData, reviewed_by || 'system');
      });
    } else if (status === 'rejected') {
      DBUtils.runQuery(
        `UPDATE renewal_quotes SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
        ['rejected', reviewed_by, now, now, req.params.id]
      );
    }
    
    DBUtils.logOperation('renewal', 'review', req.params.id, oldRenewal, req.body, reviewed_by || 'system');
    
    const updatedRenewal = DBUtils.getQuery('SELECT * FROM renewal_quotes WHERE id = ?', [req.params.id]);
    res.json(updatedRenewal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

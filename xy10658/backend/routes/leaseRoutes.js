const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.get('/', (req, res) => {
  try {
    const leases = DBUtils.allQuery('SELECT * FROM lease_contracts ORDER BY created_at DESC');
    res.json(leases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const lease = DBUtils.getQuery('SELECT * FROM lease_contracts WHERE id = ?', [req.params.id]);
    if (!lease) {
      return res.status(404).json({ error: 'Lease contract not found' });
    }
    res.json(lease);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { room_number, tenant_name, tenant_phone, start_date, end_date, monthly_rent, deposit_amount, created_by } = req.body;
    const id = DBUtils.generateId();
    const now = DBUtils.now();
    
    DBUtils.runQuery(
      `INSERT INTO lease_contracts (id, room_number, tenant_name, tenant_phone, start_date, end_date, monthly_rent, deposit_amount, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, room_number, tenant_name, tenant_phone, start_date, end_date, monthly_rent, deposit_amount, 'active', now, now, created_by || 'system']
    );
    
    DBUtils.logOperation('lease', 'create', id, null, req.body, created_by || 'system');
    
    const newLease = DBUtils.getQuery('SELECT * FROM lease_contracts WHERE id = ?', [id]);
    res.status(201).json(newLease);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const oldLease = DBUtils.getQuery('SELECT * FROM lease_contracts WHERE id = ?', [req.params.id]);
    if (!oldLease) {
      return res.status(404).json({ error: 'Lease contract not found' });
    }
    
    const { room_number, tenant_name, tenant_phone, start_date, end_date, monthly_rent, deposit_amount, status, updated_by } = req.body;
    const now = DBUtils.now();
    
    DBUtils.runQuery(
      `UPDATE lease_contracts 
       SET room_number = ?, tenant_name = ?, tenant_phone = ?, start_date = ?, end_date = ?, monthly_rent = ?, deposit_amount = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [room_number, tenant_name, tenant_phone, start_date, end_date, monthly_rent, deposit_amount, status, now, req.params.id]
    );
    
    DBUtils.logOperation('lease', 'update', req.params.id, oldLease, req.body, updated_by || 'system');
    
    const updatedLease = DBUtils.getQuery('SELECT * FROM lease_contracts WHERE id = ?', [req.params.id]);
    res.json(updatedLease);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

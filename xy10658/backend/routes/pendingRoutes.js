const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.get('/', (req, res) => {
  try {
    const pendings = DBUtils.allQuery(`
      SELECT pc.*, lc.room_number, lc.tenant_name 
      FROM pending_contracts pc
      LEFT JOIN lease_contracts lc ON pc.contract_id = lc.id
      ORDER BY pc.created_at DESC
    `);
    res.json(pendings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { contract_id, request_type, request_data, created_by } = req.body;
    
    const existing = DBUtils.getQuery(
      'SELECT id FROM pending_contracts WHERE contract_id = ? AND status = ?',
      [contract_id, 'pending']
    );
    
    if (existing) {
      return res.status(400).json({ error: '该合同已有待确认的请求' });
    }
    
    const contract = DBUtils.getQuery('SELECT id FROM lease_contracts WHERE id = ?', [contract_id]);
    if (!contract) {
      return res.status(404).json({ error: 'Lease contract not found' });
    }
    
    const id = DBUtils.generateId();
    const now = DBUtils.now();
    
    DBUtils.runQuery(
      `INSERT INTO pending_contracts (id, contract_id, request_type, request_data, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, contract_id, request_type, JSON.stringify(request_data), 'pending', now, created_by || 'system']
    );
    
    DBUtils.logOperation('pending', 'create', id, null, req.body, created_by || 'system');
    
    const newPending = DBUtils.getQuery('SELECT * FROM pending_contracts WHERE id = ?', [id]);
    res.status(201).json(newPending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/process', (req, res) => {
  try {
    const { status, processed_by } = req.body;
    const oldPending = DBUtils.getQuery('SELECT * FROM pending_contracts WHERE id = ?', [req.params.id]);
    
    if (!oldPending) {
      return res.status(404).json({ error: 'Pending contract not found' });
    }
    
    const now = DBUtils.now();
    
    if (status === 'processed') {
      DBUtils.transaction(() => {
        DBUtils.runQuery(
          `UPDATE pending_contracts SET status = ?, created_at = ? WHERE id = ?`,
          ['processed', now, req.params.id]
        );
      });
    } else if (status === 'cancelled') {
      DBUtils.runQuery(
        `UPDATE pending_contracts SET status = ?, created_at = ? WHERE id = ?`,
        ['cancelled', now, req.params.id]
      );
    }
    
    DBUtils.logOperation('pending', 'process', req.params.id, oldPending, req.body, processed_by || 'system');
    
    const updatedPending = DBUtils.getQuery('SELECT * FROM pending_contracts WHERE id = ?', [req.params.id]);
    res.json(updatedPending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

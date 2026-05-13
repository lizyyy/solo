const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { calculateBill } = require('../services/billCalculator');

router.get('/', (req, res) => {
  const { status, has_exception, bill_month } = req.query;
  let query = `SELECT b.*, c.room_no, t.name as tenant_name 
               FROM bills b 
               LEFT JOIN contracts c ON b.contract_id = c.id 
               LEFT JOIN tenants t ON c.tenant_id = t.id 
               WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }
  if (has_exception === 'true') {
    query += ' AND b.has_exception = 1';
  }
  if (has_exception === 'false') {
    query += ' AND b.has_exception = 0';
  }
  if (bill_month) {
    query += ' AND b.bill_month = ?';
    params.push(bill_month);
  }
  query += ' ORDER BY b.bill_month DESC, b.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/exceptions', (req, res) => {
  db.all(`SELECT b.*, c.room_no, t.name as tenant_name 
          FROM bills b 
          LEFT JOIN contracts c ON b.contract_id = c.id 
          LEFT JOIN tenants t ON c.tenant_id = t.id 
          WHERE b.has_exception = 1 AND b.handled_at IS NULL
          ORDER BY b.bill_month DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/calculate', async (req, res) => {
  try {
    const { contract_id, bill_month } = req.body;
    const billData = await calculateBill(contract_id, bill_month);
    res.json(billData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { contract_id, bill_month, operator } = req.body;
    const billData = await calculateBill(contract_id, bill_month);
    
    db.get('SELECT id FROM bills WHERE contract_id = ? AND bill_month = ?', 
      [contract_id, bill_month], (err, existing) => {
        if (err) throw err;
        if (existing) {
          return res.status(400).json({ error: '该月账单已存在' });
        }
        
        const stmt = db.prepare(`INSERT INTO bills 
          (contract_id, bill_month, water_usage, water_amount, electric_usage, electric_amount, device_amount, total_amount, unpaid_amount, has_exception, exception_type, exception_desc) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
        stmt.run(
          billData.contract_id,
          billData.bill_month,
          billData.water_usage,
          billData.water_amount,
          billData.electric_usage,
          billData.electric_amount,
          billData.device_amount,
          billData.total_amount,
          billData.unpaid_amount,
          billData.has_exception,
          billData.exception_type,
          billData.exception_desc,
          function(err) {
            if (err) throw err;
            const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, new_values, operator) VALUES (?, ?, ?, ?, ?)');
            auditStmt.run('bills', this.lastID, 'create', JSON.stringify(billData), operator || 'system');
            res.json({ id: this.lastID, ...billData });
          }
        );
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/handle', (req, res) => {
  const { handled_by, remarks } = req.body;
  db.get('SELECT * FROM bills WHERE id = ?', [req.params.id], (err, oldData) => {
    if (err) res.status(500).json({ error: err.message });
    else {
      const stmt = db.prepare('UPDATE bills SET handled_by = ?, handled_at = CURRENT_TIMESTAMP, has_exception = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(handled_by, req.params.id, function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, old_values, new_values, operator) VALUES (?, ?, ?, ?, ?, ?)');
          auditStmt.run('bills', req.params.id, 'handle_exception', JSON.stringify(oldData), JSON.stringify({ handled_by, remarks }), handled_by);
          res.json({ success: true, id: req.params.id });
        }
      });
    }
  });
});

router.put('/:id/pay', (req, res) => {
  const { paid_amount, operator } = req.body;
  db.get('SELECT * FROM bills WHERE id = ?', [req.params.id], (err, oldData) => {
    if (err) res.status(500).json({ error: err.message });
    else {
      const newPaid = (oldData.paid_amount || 0) + parseFloat(paid_amount);
      const newUnpaid = oldData.total_amount - newPaid;
      const newStatus = newUnpaid <= 0 ? 'paid' : 'partial';
      
      const stmt = db.prepare('UPDATE bills SET paid_amount = ?, unpaid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(newPaid, newUnpaid, newStatus, req.params.id, function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, old_values, new_values, operator) VALUES (?, ?, ?, ?, ?, ?)');
          auditStmt.run('bills', req.params.id, 'payment', JSON.stringify(oldData), JSON.stringify({ paid_amount, newStatus }), operator || 'system');
          res.json({ success: true, id: req.params.id, paid_amount: newPaid, status: newStatus });
        }
      });
    }
  });
});

module.exports = router;

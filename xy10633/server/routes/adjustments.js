const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  db.all(`SELECT a.*, b.bill_month, c.room_no, t.name as tenant_name 
          FROM adjustments a 
          LEFT JOIN bills b ON a.bill_id = b.id 
          LEFT JOIN contracts c ON b.contract_id = c.id 
          LEFT JOIN tenants t ON c.tenant_id = t.id 
          ORDER BY a.created_at DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/bill/:billId', (req, res) => {
  db.all(`SELECT * FROM adjustments WHERE bill_id = ? ORDER BY created_at DESC`, 
    [req.params.billId], (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
});

router.post('/', (req, res) => {
  const { bill_id, adjust_type, adjust_amount, adjust_reason, adjusted_by, old_value, new_value, remarks } = req.body;
  
  db.get('SELECT * FROM bills WHERE id = ?', [bill_id], (err, bill) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!bill) res.status(404).json({ error: '账单不存在' });
    else {
      const stmt = db.prepare(`INSERT INTO adjustments 
        (bill_id, adjust_type, adjust_amount, adjust_reason, adjusted_by, old_value, new_value, remarks) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      
      stmt.run(bill_id, adjust_type, adjust_amount, adjust_reason, adjusted_by, old_value, new_value, remarks, function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const newTotal = bill.total_amount + parseFloat(adjust_amount);
          const newUnpaid = newTotal - (bill.paid_amount || 0);
          
          db.run('UPDATE bills SET total_amount = ?, unpaid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
            [newTotal, newUnpaid, bill_id], (updateErr) => {
              if (updateErr) res.status(500).json({ error: updateErr.message });
              else {
                const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, new_values, operator) VALUES (?, ?, ?, ?, ?)');
                auditStmt.run('adjustments', this.lastID, 'create', JSON.stringify(req.body), adjusted_by);
                res.json({ id: this.lastID, ...req.body, new_total: newTotal });
              }
            });
        }
      });
    }
  });
});

module.exports = router;

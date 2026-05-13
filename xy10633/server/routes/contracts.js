const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  db.all(`SELECT c.*, t.name as tenant_name 
          FROM contracts c 
          LEFT JOIN tenants t ON c.tenant_id = t.id 
          ORDER BY c.created_at DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`SELECT c.*, t.name as tenant_name 
          FROM contracts c 
          LEFT JOIN tenants t ON c.tenant_id = t.id 
          WHERE c.id = ?`, [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row);
  });
});

router.post('/', (req, res) => {
  const { tenant_id, contract_no, room_no, start_date, end_date, monthly_rent, area, share_ratio } = req.body;
  const stmt = db.prepare('INSERT INTO contracts (tenant_id, contract_no, room_no, start_date, end_date, monthly_rent, area, share_ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(tenant_id, contract_no, room_no, start_date, end_date, monthly_rent, area, share_ratio, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, new_values, operator) VALUES (?, ?, ?, ?, ?)');
      auditStmt.run('contracts', this.lastID, 'create', JSON.stringify(req.body), 'system');
      res.json({ id: this.lastID, ...req.body });
    }
  });
});

router.put('/:id', (req, res) => {
  db.get('SELECT * FROM contracts WHERE id = ?', [req.params.id], (err, oldData) => {
    const { tenant_id, contract_no, room_no, start_date, end_date, monthly_rent, area, share_ratio, status } = req.body;
    const stmt = db.prepare('UPDATE contracts SET tenant_id = ?, contract_no = ?, room_no = ?, start_date = ?, end_date = ?, monthly_rent = ?, area = ?, share_ratio = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(tenant_id, contract_no, room_no, start_date, end_date, monthly_rent, area, share_ratio, status || 'active', req.params.id, function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, old_values, new_values, operator) VALUES (?, ?, ?, ?, ?, ?)');
        auditStmt.run('contracts', req.params.id, 'update', JSON.stringify(oldData), JSON.stringify(req.body), 'system');
        res.json({ id: req.params.id, ...req.body });
      }
    });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  db.all(`SELECT d.*, c.room_no, t.name as tenant_name 
          FROM special_devices d 
          LEFT JOIN contracts c ON d.contract_id = c.id 
          LEFT JOIN tenants t ON c.tenant_id = t.id 
          ORDER BY d.created_at DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { contract_id, device_name, device_type, power, hours_per_day, days_per_month, fixed_usage } = req.body;
  const stmt = db.prepare('INSERT INTO special_devices (contract_id, device_name, device_type, power, hours_per_day, days_per_month, fixed_usage) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(contract_id, device_name, device_type, power, hours_per_day, days_per_month, fixed_usage, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, new_values, operator) VALUES (?, ?, ?, ?, ?)');
      auditStmt.run('special_devices', this.lastID, 'create', JSON.stringify(req.body), 'system');
      res.json({ id: this.lastID, ...req.body });
    }
  });
});

router.put('/:id', (req, res) => {
  db.get('SELECT * FROM special_devices WHERE id = ?', [req.params.id], (err, oldData) => {
    const { contract_id, device_name, device_type, power, hours_per_day, days_per_month, fixed_usage, status } = req.body;
    const stmt = db.prepare('UPDATE special_devices SET contract_id = ?, device_name = ?, device_type = ?, power = ?, hours_per_day = ?, days_per_month = ?, fixed_usage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(contract_id, device_name, device_type, power, hours_per_day, days_per_month, fixed_usage, status || 'active', req.params.id, function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, old_values, new_values, operator) VALUES (?, ?, ?, ?, ?, ?)');
        auditStmt.run('special_devices', req.params.id, 'update', JSON.stringify(oldData), JSON.stringify(req.body), 'system');
        res.json({ id: req.params.id, ...req.body });
      }
    });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  db.all(`SELECT m.*, c.room_no, t.name as tenant_name 
          FROM meter_readings m 
          LEFT JOIN contracts c ON m.contract_id = c.id 
          LEFT JOIN tenants t ON c.tenant_id = t.id 
          ORDER BY m.reading_date DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { contract_id, reading_date, water_prev, water_curr, water_usage, electric_prev, electric_curr, electric_usage, reader, remarks } = req.body;
  const stmt = db.prepare('INSERT INTO meter_readings (contract_id, reading_date, water_prev, water_curr, water_usage, electric_prev, electric_curr, electric_usage, reader, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(contract_id, reading_date, water_prev, water_curr, water_usage, electric_prev, electric_curr, electric_usage, reader, remarks, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      const auditStmt = db.prepare('INSERT INTO audit_logs (table_name, record_id, operation, new_values, operator) VALUES (?, ?, ?, ?, ?)');
      auditStmt.run('meter_readings', this.lastID, 'create', JSON.stringify(req.body), 'system');
      res.json({ id: this.lastID, ...req.body });
    }
  });
});

module.exports = router;

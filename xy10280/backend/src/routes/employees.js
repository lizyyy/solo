const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM employees ORDER BY employee_id', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM employees WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, employee_id, department, phone, email } = req.body;
  const sql = 'INSERT INTO employees (name, employee_id, department, phone, email) VALUES (?, ?, ?, ?, ?)';
  db.run(sql, [name, employee_id, department, phone, email], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, ...req.body });
  });
});

router.put('/:id', (req, res) => {
  const { name, employee_id, department, phone, email } = req.body;
  const sql = 'UPDATE employees SET name=?, employee_id=?, department=?, phone=?, email=? WHERE id=?';
  db.run(sql, [name, employee_id, department, phone, email, req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: req.params.id, ...req.body });
  });
});

router.get('/:id/registrations', (req, res) => {
  const sql = `SELECT r.*, s.name as station_name, r2.name as route_name 
               FROM registrations r 
               LEFT JOIN stations s ON r.station_id = s.id 
               LEFT JOIN routes r2 ON r.route_id = r2.id 
               WHERE r.employee_id = ?`;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;

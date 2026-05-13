const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  const { table_name, operator, start_date, end_date } = req.query;
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];
  
  if (table_name) {
    query += ' AND table_name = ?';
    params.push(table_name);
  }
  if (operator) {
    query += ' AND operator = ?';
    params.push(operator);
  }
  if (start_date) {
    query += ' AND DATE(created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND DATE(created_at) <= ?';
    params.push(end_date);
  }
  query += ' ORDER BY created_at DESC LIMIT 500';
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

module.exports = router;

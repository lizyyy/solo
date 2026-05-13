const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/:businessType/:businessId', (req, res) => {
  const { businessType, businessId } = req.params;
  const sql = `SELECT * FROM operation_log WHERE business_type = ? AND business_id = ? ORDER BY operation_time DESC`;
  
  db.all(sql, [businessType, businessId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/', (req, res) => {
  const { operator_id, start_time, end_time, business_type } = req.query;
  
  let sql = `SELECT * FROM operation_log WHERE 1=1`;
  const params = [];
  
  if (operator_id) {
    sql += ` AND operator_id = ?`;
    params.push(operator_id);
  }
  
  if (start_time) {
    sql += ` AND operation_time >= ?`;
    params.push(start_time);
  }
  
  if (end_time) {
    sql += ` AND operation_time <= ?`;
    params.push(end_time);
  }
  
  if (business_type) {
    sql += ` AND business_type = ?`;
    params.push(business_type);
  }
  
  sql += ` ORDER BY operation_time DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;
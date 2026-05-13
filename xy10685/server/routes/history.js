const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { errorResponse, successResponse } = require('../utils');

router.get('/', (req, res) => {
  const { record_id, operation_type, operator } = req.query;
  
  let sql = `SELECT * FROM operation_history WHERE 1=1`;
  const params = [];

  if (record_id) {
    sql += ` AND record_id = ?`;
    params.push(record_id);
  }
  if (operation_type) {
    sql += ` AND operation_type = ?`;
    params.push(operation_type);
  }
  if (operator) {
    sql += ` AND operator LIKE ?`;
    params.push(`%${operator}%`);
  }

  sql += ` ORDER BY operation_time DESC LIMIT 100`;

  db.all(sql, params, (err, rows) => {
    if (err) return errorResponse(res, err.message);
    successResponse(res, rows);
  });
});

router.get('/stats', (req, res) => {
  db.all(`
    SELECT 
      operation_type,
      COUNT(*) as count
    FROM operation_history
    GROUP BY operation_type
    ORDER BY count DESC
  `, (err, rows) => {
    if (err) return errorResponse(res, err.message);
    successResponse(res, rows);
  });
});

module.exports = router;

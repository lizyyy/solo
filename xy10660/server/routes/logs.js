const express = require('express');
const router = express.Router();
const { runQuery } = require('../database');

router.get('/', async (req, res) => {
  try {
    const { license_id, operation_type, operation_status } = req.query;
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (license_id) {
      sql += ' AND license_id = ?';
      params.push(license_id);
    }
    if (operation_type) {
      sql += ' AND operation_type = ?';
      params.push(operation_type);
    }
    if (operation_status) {
      sql += ' AND operation_status = ?';
      params.push(operation_status);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const logs = await runQuery(sql, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

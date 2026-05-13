const express = require('express');
const router = express.Router();
const { all } = require('../database');

router.get('/', async (req, res) => {
  try {
    const { module, operator, action } = req.query;
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (module) {
      sql += ' AND module = ?';
      params.push(module);
    }
    if (operator) {
      sql += ' AND operator = ?';
      params.push(operator);
    }
    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    
    const logs = await all(sql, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

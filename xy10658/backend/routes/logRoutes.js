const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.get('/', (req, res) => {
  try {
    const { module, operator, limit = 100 } = req.query;
    
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    let params = [];
    
    if (module) {
      sql += ' AND module = ?';
      params.push(module);
    }
    
    if (operator) {
      sql += ' AND operator LIKE ?';
      params.push(`%${operator}%`);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const logs = DBUtils.allQuery(sql, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/record/:recordId', (req, res) => {
  try {
    const logs = DBUtils.allQuery(
      'SELECT * FROM operation_logs WHERE record_id = ? ORDER BY created_at DESC',
      [req.params.recordId]
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

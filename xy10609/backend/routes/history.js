const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');

router.get('/', async (req, res) => {
  try {
    const { tableName, recordId, changedBy } = req.query;
    
    let sql = 'SELECT * FROM change_history WHERE 1=1';
    const params = [];

    if (tableName) {
      sql += ' AND table_name = ?';
      params.push(tableName);
    }

    if (recordId) {
      sql += ' AND record_id = ?';
      params.push(recordId);
    }

    if (changedBy) {
      sql += ' AND changed_by LIKE ?';
      params.push(`%${changedBy}%`);
    }

    sql += ' ORDER BY changed_at DESC LIMIT 100';

    const history = await db.all(sql, params);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

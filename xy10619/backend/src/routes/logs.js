const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  const { tableName, recordId } = req.query;
  let query = `
    SELECT ml.*, s.name as modified_by_name
    FROM modification_logs ml
    LEFT JOIN staff s ON ml.modified_by = s.id
    WHERE 1=1
  `;
  const params = [];

  if (tableName) {
    query += ' AND ml.table_name = ?';
    params.push(tableName);
  }
  if (recordId) {
    query += ' AND ml.record_id = ?';
    params.push(recordId);
  }

  query += ' ORDER BY ml.modified_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/:relatedType/:relatedId', (req, res) => {
  const { relatedType, relatedId } = req.params;
  const sql = `SELECT * FROM time_lines 
                WHERE related_type = ? AND related_id = ?
                ORDER BY operation_time ASC`;
  db.all(sql, [relatedType, relatedId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows.map(row => ({
        ...row,
        old_value: row.old_value ? JSON.parse(row.old_value) : null,
        new_value: row.new_value ? JSON.parse(row.new_value) : null
      })));
    }
  });
});

module.exports = router;
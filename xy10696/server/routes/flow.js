const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { device_number, flow_type, start_date, end_date } = req.query;
  let query = 'SELECT * FROM flow_records WHERE 1=1';
  const params = [];

  if (device_number) {
    query += ' AND device_number LIKE ?';
    params.push(`%${device_number}%`);
  }
  if (flow_type) {
    query += ' AND flow_type = ?';
    params.push(flow_type);
  }
  if (start_date) {
    query += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND created_at <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:deviceId', (req, res) => {
  db.all(
    'SELECT * FROM flow_records WHERE device_id = ? ORDER BY created_at DESC',
    [req.params.deviceId],
    (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    }
  );
});

module.exports = router;

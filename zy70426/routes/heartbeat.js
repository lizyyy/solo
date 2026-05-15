const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/report', (req, res) => {
  const { service_name, status, error_message } = req.body;
  const last_report_time = new Date().toISOString();
  
  db.get('SELECT * FROM heartbeat WHERE service_name = ? ORDER BY id DESC LIMIT 1', [service_name], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let last_normal_time = null;
    
    if (status === 'normal') {
      last_normal_time = last_report_time;
    } else if (row && row.status === 'normal') {
      last_normal_time = row.last_normal_time || row.last_report_time;
    } else if (row) {
      last_normal_time = row.last_normal_time;
    }

    db.run(
      'INSERT INTO heartbeat (service_name, status, last_normal_time, last_report_time, error_message) VALUES (?, ?, ?, ?, ?)',
      [service_name, status, last_normal_time, last_report_time, error_message],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: this.lastID,
          service_name,
          status,
          last_normal_time,
          last_report_time,
          error_message
        });
      }
    );
  });
});

router.get('/status', (req, res) => {
  db.all('SELECT * FROM heartbeat ORDER BY last_report_time DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/status/:service_name', (req, res) => {
  const { service_name } = req.params;
  db.get('SELECT * FROM heartbeat WHERE service_name = ? ORDER BY id DESC LIMIT 1', [service_name], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(row);
  });
});

module.exports = router;

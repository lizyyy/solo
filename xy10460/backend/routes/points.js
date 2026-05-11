const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/flow', (req, res) => {
  const sql = `
    SELECT pf.*, r.name as resident_name
    FROM points_flow pf
    JOIN residents r ON pf.resident_id = r.id
    ORDER BY pf.record_time DESC
  `;
  
  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/flow/:residentId', (req, res) => {
  const residentId = req.params.residentId;
  
  db.all(`
    SELECT * FROM points_flow 
    WHERE resident_id = ? 
    ORDER BY record_time DESC
  `, [residentId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/summary', (req, res) => {
  const sql = `
    SELECT 
      r.id,
      r.name,
      r.total_points,
      COUNT(dr.id) as delivery_count,
      COALESCE(SUM(CASE WHEN pf.type = 'delivery' THEN pf.points ELSE 0 END), 0) as total_earned,
      COALESCE(SUM(CASE WHEN pf.type = 'deduction' THEN pf.points ELSE 0 END), 0) as total_deducted,
      COALESCE(SUM(CASE WHEN pf.type = 'exchange' THEN pf.points ELSE 0 END), 0) as total_exchanged
    FROM residents r
    LEFT JOIN delivery_records dr ON r.id = dr.resident_id
    LEFT JOIN points_flow pf ON r.id = pf.resident_id
    GROUP BY r.id
    ORDER BY r.total_points DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;

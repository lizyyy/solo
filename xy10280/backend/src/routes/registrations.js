const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { period, station_id, employee_id } = req.query;
  let sql = `SELECT r.*, e.name as employee_name, e.employee_id as emp_id, 
             s.name as station_name, r2.name as route_name 
             FROM registrations r 
             LEFT JOIN employees e ON r.employee_id = e.id 
             LEFT JOIN stations s ON r.station_id = s.id 
             LEFT JOIN routes r2 ON r.route_id = r2.id 
             WHERE 1=1`;
  const params = [];
  
  if (period) {
    sql += ' AND r.period = ?';
    params.push(period);
  }
  if (station_id) {
    sql += ' AND r.station_id = ?';
    params.push(station_id);
  }
  if (employee_id) {
    sql += ' AND r.employee_id = ?';
    params.push(employee_id);
  }
  sql += ' ORDER BY r.created_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { employee_id, station_id, route_id, period, week_days } = req.body;
  const sql = `INSERT INTO registrations (employee_id, station_id, route_id, period, week_days) 
               VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [employee_id, station_id, route_id, period, week_days], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, ...req.body });
  });
});

router.put('/:id', (req, res) => {
  const { period, week_days, status } = req.body;
  const sql = 'UPDATE registrations SET period=?, week_days=?, status=? WHERE id=?';
  db.run(sql, [period, week_days, status, req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: req.params.id, ...req.body });
  });
});

router.get('/by-station/:stationId', (req, res) => {
  const sql = `SELECT r.*, e.name as employee_name, e.department 
               FROM registrations r 
               LEFT JOIN employees e ON r.employee_id = e.id 
               WHERE r.station_id = ? AND r.status = ?`;
  db.all(sql, [req.params.stationId, 'active'], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;

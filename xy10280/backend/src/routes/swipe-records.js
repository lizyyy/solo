const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { start_date, end_date, station_id, employee_id } = req.query;
  let sql = `SELECT sr.*, e.name as employee_name, e.employee_id as emp_id,
             s.name as station_name, r.name as route_name 
             FROM swipe_records sr 
             LEFT JOIN employees e ON sr.employee_id = e.id 
             LEFT JOIN stations s ON sr.station_id = s.id 
             LEFT JOIN routes r ON sr.route_id = r.id 
             WHERE 1=1`;
  const params = [];
  
  if (start_date) {
    sql += ' AND sr.swipe_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND sr.swipe_time <= ?';
    params.push(end_date);
  }
  if (station_id) {
    sql += ' AND sr.station_id = ?';
    params.push(station_id);
  }
  if (employee_id) {
    sql += ' AND sr.employee_id = ?';
    params.push(employee_id);
  }
  sql += ' ORDER BY sr.swipe_time DESC LIMIT 500';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { employee_id, station_id, route_id, swipe_time, direction, device_id } = req.body;
  const sql = `INSERT INTO swipe_records (employee_id, station_id, route_id, swipe_time, direction, device_id) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [employee_id, station_id, route_id, swipe_time, direction, device_id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, ...req.body });
  });
});

router.get('/by-station/:stationId', (req, res) => {
  const { start_date, end_date } = req.query;
  let sql = `SELECT COUNT(DISTINCT employee_id) as actual_count, 
             COUNT(*) as swipe_total,
             DATE(swipe_time) as swipe_date
             FROM swipe_records 
             WHERE station_id = ?`;
  const params = [req.params.stationId];
  
  if (start_date) {
    sql += ' AND swipe_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND swipe_time <= ?';
    params.push(end_date);
  }
  sql += ' GROUP BY DATE(swipe_time) ORDER BY swipe_date';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;

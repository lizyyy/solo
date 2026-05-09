const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculateHeatScore, calculateDifferenceRate, getHeatLevel } = require('../services/heatCalculation');

router.get('/station-heat', (req, res) => {
  const { period = 'month', route_id } = req.query;
  
  let days = 30;
  if (period === 'week') days = 7;
  else if (period === 'quarter') days = 90;
  
  const dateRange = `DATE('now', '-${days} days')`;
  
  let sql = `SELECT s.id as station_id, s.name as station_name, s.code as station_code,
             s.route_id, r.name as route_name, r.code as route_code,
             (SELECT COUNT(*) FROM registrations WHERE station_id = s.id AND status = 'active') as registration_count
             FROM stations s
             LEFT JOIN routes r ON s.route_id = r.id
             WHERE s.status = 'active'`;
  const params = [];
  
  if (route_id) {
    sql += ' AND s.route_id = ?';
    params.push(route_id);
  }
  sql += ' GROUP BY s.id';
  
  db.all(sql, params, (err, stations) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const results = stations.map(station => {
      return new Promise((resolve) => {
        db.get(`SELECT COUNT(DISTINCT employee_id) as actual_count 
                FROM swipe_records 
                WHERE station_id = ? AND DATE(swipe_time) >= ${dateRange}`,
                [station.station_id], (err, swipe) => {
          if (err) {
            resolve({ ...station, actual_count: 0, difference_rate: 0, heat_score: 0, heat_level: 'high' });
            return;
          }
          
          const actual_count = swipe?.actual_count || 0;
          const difference_rate = calculateDifferenceRate(station.registration_count, actual_count);
          const heat_score = calculateHeatScore(difference_rate, station.registration_count);
          const heat_level = getHeatLevel(heat_score);
          
          resolve({
            ...station,
            actual_count,
            difference_rate,
            heat_score,
            heat_level
          });
        });
      });
    });
    
    Promise.all(results).then(data => {
      data.sort((a, b) => a.heat_score - b.heat_score);
      res.json(data);
    });
  });
});

router.get('/historical', (req, res) => {
  const { station_id, period = 'month' } = req.query;
  
  let groupBy = 'week';
  let limit = 12;
  if (period === 'week') {
    groupBy = 'day';
    limit = 7;
  } else if (period === 'quarter') {
    groupBy = 'month';
    limit = 3;
  }
  
  const sql = `SELECT 
               ha.*,
               s.name as station_name,
               r.name as route_name
               FROM heat_analyses ha
               LEFT JOIN stations s ON ha.station_id = s.id
               LEFT JOIN routes r ON ha.route_id = r.id
               WHERE ha.station_id = ?
               ORDER BY ha.created_at DESC
               LIMIT ?`;
  
  db.all(sql, [station_id, limit], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/trends', (req, res) => {
  const { station_id } = req.query;
  
  const sql = `SELECT 
               DATE(swipe_time) as date,
               COUNT(DISTINCT employee_id) as actual_count,
               (SELECT COUNT(*) FROM registrations 
                WHERE station_id = ? AND status = 'active' 
                AND DATE(created_at) <= DATE(swipe_time)) as registration_count
               FROM swipe_records
               WHERE station_id = ? 
               AND DATE(swipe_time) >= DATE('now', '-30 days')
               GROUP BY DATE(swipe_time)
               ORDER BY date`;
  
  db.all(sql, [station_id, station_id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const trends = rows.map(row => ({
      ...row,
      difference_rate: calculateDifferenceRate(row.registration_count, row.actual_count)
    }));
    
    res.json(trends);
  });
});

router.get('/warnings', (req, res) => {
  const sql = `SELECT s.id as station_id, s.name as station_name, s.code,
               r.name as route_name,
               (SELECT COUNT(*) FROM registrations WHERE station_id = s.id AND status = 'active') as reg_count,
               (SELECT COUNT(DISTINCT employee_id) FROM swipe_records 
                WHERE station_id = s.id AND DATE(swipe_time) >= DATE('now', '-30 days')) as actual_count
               FROM stations s
               LEFT JOIN routes r ON s.route_id = r.id
               WHERE s.status = 'active'
               HAVING reg_count >= 5`;
  
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const warnings = rows
      .map(row => ({
        ...row,
        difference_rate: calculateDifferenceRate(row.reg_count, row.actual_count)
      }))
      .filter(row => row.difference_rate >= 0.5)
      .sort((a, b) => b.difference_rate - a.difference_rate);
    
    res.json(warnings);
  });
});

module.exports = router;

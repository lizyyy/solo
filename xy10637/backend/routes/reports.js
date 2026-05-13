const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const db = require('../config/database');

router.get('/schedules', (req, res) => {
  const { start_date, end_date, ward_id, status, operator } = req.query;
  
  let sql = `SELECT s.id, s.date, s.shift_type, s.status, 
              c.name as caregiver_name, w.name as ward_name,
              s.created_at, s.updated_at
              FROM schedules s
              LEFT JOIN caregivers c ON s.caregiver_id = c.id
              LEFT JOIN ward_demands wd ON s.ward_demand_id = wd.id
              LEFT JOIN wards w ON wd.ward_id = w.id
              WHERE 1=1`;
  const params = [];
  
  if (start_date) {
    sql += ` AND s.date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND s.date <= ?`;
    params.push(end_date);
  }
  if (ward_id) {
    sql += ` AND w.id = ?`;
    params.push(ward_id);
  }
  if (status) {
    sql += ` AND s.status = ?`;
    params.push(status);
  }
  
  sql += ` ORDER BY s.date DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const parser = new Parser();
      const csv = parser.parse(rows);
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`schedules_report_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    }
  });
});

router.get('/work-hours', (req, res) => {
  const { start_date, end_date, caregiver_id, hour_type } = req.query;
  
  let sql = `SELECT wh.id, wh.date, wh.hours, wh.hour_type, wh.remarks,
              c.name as caregiver_name
              FROM work_hour_records wh
              LEFT JOIN caregivers c ON wh.caregiver_id = c.id
              WHERE 1=1`;
  const params = [];
  
  if (start_date) {
    sql += ` AND wh.date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND wh.date <= ?`;
    params.push(end_date);
  }
  if (caregiver_id) {
    sql += ` AND wh.caregiver_id = ?`;
    params.push(caregiver_id);
  }
  if (hour_type) {
    sql += ` AND wh.hour_type = ?`;
    params.push(hour_type);
  }
  
  sql += ` ORDER BY wh.date DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const parser = new Parser();
      const csv = parser.parse(rows);
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`work_hours_report_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    }
  });
});

router.get('/audit-logs', (req, res) => {
  const { start_date, end_date, table_name, operator } = req.query;
  
  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];
  
  if (start_date) {
    sql += ` AND operation_time >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND operation_time <= ?`;
    params.push(end_date + ' 23:59:59');
  }
  if (table_name) {
    sql += ` AND table_name = ?`;
    params.push(table_name);
  }
  
  sql += ` ORDER BY operation_time DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const parser = new Parser();
      const csv = parser.parse(rows);
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`audit_logs_report_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    }
  });
});

module.exports = router;
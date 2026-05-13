const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateId, addTimeLine } = require('../utils/helpers');

router.get('/', (req, res) => {
  const sql = `SELECT wh.*, c.name as caregiver_name 
                FROM work_hour_records wh
                LEFT JOIN caregivers c ON wh.caregiver_id = c.id
                ORDER BY wh.date DESC, wh.created_at DESC`;
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.post('/', (req, res) => {
  const { caregiver_id, schedule_id, date, hours, hour_type, related_record_id, remarks } = req.body;
  const id = generateId();
  
  const sql = `INSERT INTO work_hour_records (id, caregiver_id, schedule_id, date, hours, hour_type, related_record_id, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, caregiver_id, schedule_id, date, hours, hour_type, related_record_id, remarks], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      await addTimeLine('work_hour', id, 'create', `录入工时：${hours}小时 (${hour_type})`);
      res.json({ id, caregiver_id, date, hours });
    }
  });
});

router.get('/summary', (req, res) => {
  const { start_date, end_date, caregiver_id } = req.query;
  let sql = `SELECT caregiver_id, c.name, SUM(hours) as total_hours, hour_type, COUNT(*) as record_count
              FROM work_hour_records wh
              LEFT JOIN caregivers c ON wh.caregiver_id = c.id
              WHERE 1=1`;
  const params = [];
  
  if (start_date) {
    sql += ` AND date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND date <= ?`;
    params.push(end_date);
  }
  if (caregiver_id) {
    sql += ` AND caregiver_id = ?`;
    params.push(caregiver_id);
  }
  
  sql += ` GROUP BY caregiver_id, hour_type ORDER BY total_hours DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

module.exports = router;
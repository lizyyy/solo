const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 获取所有提醒记录
router.get('/', (req, res) => {
  const { elderly_id, start_date, end_date } = req.query;
  
  let query = `
    SELECT r.*, e.name as elderly_name, m.name as medicine_name, mp.dosage
    FROM reminder_records r
    LEFT JOIN elderly e ON r.elderly_id = e.id
    LEFT JOIN medicines m ON r.medicine_id = m.id
    LEFT JOIN medication_plans mp ON r.plan_id = mp.id
    WHERE 1=1
  `;
  const params = [];
  
  if (elderly_id) {
    query += ' AND r.elderly_id = ?';
    params.push(elderly_id);
  }
  
  if (start_date) {
    query += ' AND date(r.scheduled_time) >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND date(r.scheduled_time) <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY r.scheduled_time DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取今日提醒记录
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const query = `
    SELECT r.*, e.name as elderly_name, e.room, m.name as medicine_name, mp.dosage
    FROM reminder_records r
    LEFT JOIN elderly e ON r.elderly_id = e.id
    LEFT JOIN medicines m ON r.medicine_id = m.id
    LEFT JOIN medication_plans mp ON r.plan_id = mp.id
    WHERE date(r.scheduled_time) = ?
    ORDER BY r.scheduled_time ASC
  `;
  
  db.all(query, [today], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取单个提醒记录
router.get('/:id', (req, res) => {
  const query = `
    SELECT r.*, e.name as elderly_name, m.name as medicine_name, mp.dosage
    FROM reminder_records r
    LEFT JOIN elderly e ON r.elderly_id = e.id
    LEFT JOIN medicines m ON r.medicine_id = m.id
    LEFT JOIN medication_plans mp ON r.plan_id = mp.id
    WHERE r.id = ?
  `;
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '提醒记录不存在' });
      return;
    }
    res.json(row);
  });
});

// 创建提醒记录
router.post('/', (req, res) => {
  const { 
    plan_id, 
    elderly_id, 
    medicine_id, 
    scheduled_time, 
    status, 
    volunteer_name, 
    notes 
  } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO reminder_records 
     (id, plan_id, elderly_id, medicine_id, scheduled_time, status, volunteer_name, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, plan_id, elderly_id, medicine_id, scheduled_time, status || 'pending', volunteer_name, notes],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id, 
        plan_id, 
        elderly_id, 
        medicine_id, 
        scheduled_time, 
        status: status || 'pending', 
        volunteer_name, 
        notes 
      });
    }
  );
});

// 标记已提醒
router.post('/:id/reminded', (req, res) => {
  const { volunteer_name, notes } = req.body;
  const now = new Date().toISOString();
  
  db.run(
    `UPDATE reminder_records 
     SET status = 'reminded', actual_time = ?, volunteer_name = ?, notes = ?
     WHERE id = ?`,
    [now, volunteer_name, notes, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '提醒记录不存在' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        status: 'reminded', 
        actual_time: now,
        volunteer_name,
        notes 
      });
    }
  );
});

// 标记漏服
router.post('/:id/missed', (req, res) => {
  const { volunteer_name, notes } = req.body;
  const now = new Date().toISOString();
  
  db.run(
    `UPDATE reminder_records 
     SET status = 'missed', actual_time = ?, volunteer_name = ?, notes = ?
     WHERE id = ?`,
    [now, volunteer_name, notes, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '提醒记录不存在' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        status: 'missed', 
        actual_time: now,
        volunteer_name,
        notes 
      });
    }
  );
});

// 导出老人近7天记录
router.get('/export/elderly/:elderly_id', (req, res) => {
  const elderly_id = req.params.elderly_id;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const query = `
    SELECT 
      r.id,
      r.scheduled_time,
      r.actual_time,
      r.status,
      r.volunteer_name,
      r.notes,
      e.name as elderly_name,
      e.room,
      m.name as medicine_name,
      mp.dosage,
      mp.time as scheduled_time_of_day
    FROM reminder_records r
    LEFT JOIN elderly e ON r.elderly_id = e.id
    LEFT JOIN medicines m ON r.medicine_id = m.id
    LEFT JOIN medication_plans mp ON r.plan_id = mp.id
    WHERE r.elderly_id = ? 
      AND date(r.scheduled_time) >= ? 
      AND date(r.scheduled_time) <= ?
    ORDER BY r.scheduled_time DESC
  `;
  
  db.all(query, [elderly_id, startDateStr, endDateStr], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (rows.length === 0) {
      db.get('SELECT * FROM elderly WHERE id = ?', [elderly_id], (eErr, elderly) => {
        if (eErr || !elderly) {
          res.status(404).json({ error: '老人不存在' });
          return;
        }
        res.json({
          elderly: elderly,
          start_date: startDateStr,
          end_date: endDateStr,
          records: []
        });
      });
      return;
    }
    
    res.json({
      elderly: {
        id: rows[0].elderly_id,
        name: rows[0].elderly_name,
        room: rows[0].room
      },
      start_date: startDateStr,
      end_date: endDateStr,
      records: rows
    });
  });
});

module.exports = router;

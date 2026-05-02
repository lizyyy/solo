const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { validateSchedule } = require('../utils/validators');

router.get('/', (req, res) => {
  const { date } = req.query;
  
  let query = `
    SELECT 
      s.*,
      c.name as course_name,
      co.name as coach_name,
      c.duration
    FROM schedules s
    JOIN courses c ON s.course_id = c.id
    JOIN coaches co ON s.coach_id = co.id
  `;
  
  const params = [];
  
  if (date) {
    query += ` WHERE s.date = ?`;
    params.push(date);
  }
  
  query += ` ORDER BY s.date, s.start_time`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('获取排班列表失败:', err);
      res.status(500).json({ error: '获取排班列表失败' });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT 
      s.*,
      c.name as course_name,
      co.name as coach_name,
      c.duration
    FROM schedules s
    JOIN courses c ON s.course_id = c.id
    JOIN coaches co ON s.coach_id = co.id
    WHERE s.id = ?`,
    [id],
    (err, schedule) => {
      if (err) {
        console.error('获取排班信息失败:', err);
        res.status(500).json({ error: '获取排班信息失败' });
        return;
      }
      
      if (!schedule) {
        res.status(404).json({ error: '排班不存在' });
        return;
      }
      
      res.json(schedule);
    }
  );
});

router.post('/', (req, res) => {
  const errors = validateSchedule(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { course_id, coach_id, date, start_time, end_time, capacity = 10 } = req.body;
  
  db.run(
    `INSERT INTO schedules (course_id, coach_id, date, start_time, end_time, capacity, booked_count) 
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [course_id, coach_id, date, start_time, end_time, capacity],
    function (err) {
      if (err) {
        console.error('添加排班失败:', err);
        res.status(500).json({ error: '添加排班失败' });
        return;
      }
      
      res.status(201).json({
        id: this.lastID,
        course_id,
        coach_id,
        date,
        start_time,
        end_time,
        capacity,
        booked_count: 0
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const errors = validateSchedule(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { course_id, coach_id, date, start_time, end_time, capacity } = req.body;
  
  db.run(
    `UPDATE schedules 
     SET course_id = ?, coach_id = ?, date = ?, start_time = ?, end_time = ?, capacity = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [course_id, coach_id, date, start_time, end_time, capacity, id],
    function (err) {
      if (err) {
        console.error('更新排班失败:', err);
        res.status(500).json({ error: '更新排班失败' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '排班不存在' });
        return;
      }
      
      res.json({
        id,
        course_id,
        coach_id,
        date,
        start_time,
        end_time,
        capacity
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT COUNT(*) as count FROM bookings WHERE schedule_id = ? AND status = 'booked'`, [id], (err, result) => {
    if (err) {
      console.error('检查排班预约记录失败:', err);
      res.status(500).json({ error: '检查排班预约记录失败' });
      return;
    }
    
    if (result.count > 0) {
      res.status(400).json({ error: '该排班有有效预约记录，无法删除' });
      return;
    }
    
    db.run(`DELETE FROM schedules WHERE id = ?`, [id], function (err) {
      if (err) {
        console.error('删除排班失败:', err);
        res.status(500).json({ error: '删除排班失败' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '排班不存在' });
        return;
      }
      
      res.json({ message: '排班已删除' });
    });
  });
});

router.get('/:id/bookings', (req, res) => {
  const { id } = req.params;
  
  db.all(
    `SELECT 
      b.*,
      m.name as member_name,
      m.phone as member_phone
    FROM bookings b
    JOIN members m ON b.member_id = m.id
    WHERE b.schedule_id = ? AND b.status = 'booked'
    ORDER BY b.booked_at`,
    [id],
    (err, rows) => {
      if (err) {
        console.error('获取排班预约列表失败:', err);
        res.status(500).json({ error: '获取排班预约列表失败' });
        return;
      }
      res.json(rows);
    }
  );
});

module.exports = router;

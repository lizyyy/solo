const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { validateMember } = require('../utils/validators');

router.get('/', (req, res) => {
  db.all(`SELECT * FROM members ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      console.error('获取会员列表失败:', err);
      res.status(500).json({ error: '获取会员列表失败' });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM members WHERE id = ?`, [id], (err, member) => {
    if (err) {
      console.error('获取会员信息失败:', err);
      res.status(500).json({ error: '获取会员信息失败' });
      return;
    }
    
    if (!member) {
      res.status(404).json({ error: '会员不存在' });
      return;
    }
    
    res.json(member);
  });
});

router.post('/', (req, res) => {
  const errors = validateMember(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { name, phone, email, remaining_sessions = 0, status = 'active' } = req.body;
  
  db.run(
    `INSERT INTO members (name, phone, email, remaining_sessions, status) VALUES (?, ?, ?, ?, ?)`,
    [name, phone, email, remaining_sessions, status],
    function (err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          res.status(400).json({ errors: ['该手机号已存在'] });
        } else {
          console.error('添加会员失败:', err);
          res.status(500).json({ error: '添加会员失败' });
        }
        return;
      }
      
      res.status(201).json({
        id: this.lastID,
        name,
        phone,
        email,
        remaining_sessions,
        status
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const errors = validateMember(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { name, phone, email, remaining_sessions, status } = req.body;
  
  db.run(
    `UPDATE members SET name = ?, phone = ?, email = ?, remaining_sessions = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, phone, email, remaining_sessions, status, id],
    function (err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          res.status(400).json({ errors: ['该手机号已被其他会员使用'] });
        } else {
          console.error('更新会员失败:', err);
          res.status(500).json({ error: '更新会员失败' });
        }
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '会员不存在' });
        return;
      }
      
      res.json({
        id,
        name,
        phone,
        email,
        remaining_sessions,
        status
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT COUNT(*) as count FROM bookings WHERE member_id = ?`, [id], (err, result) => {
    if (err) {
      console.error('检查会员预约记录失败:', err);
      res.status(500).json({ error: '检查会员预约记录失败' });
      return;
    }
    
    if (result.count > 0) {
      res.status(400).json({ error: '该会员有预约记录，无法删除' });
      return;
    }
    
    db.run(`DELETE FROM members WHERE id = ?`, [id], function (err) {
      if (err) {
        console.error('删除会员失败:', err);
        res.status(500).json({ error: '删除会员失败' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '会员不存在' });
        return;
      }
      
      res.json({ message: '会员已删除' });
    });
  });
});

router.get('/:id/history', (req, res) => {
  const { id } = req.params;
  
  db.all(
    `SELECT 
      b.*,
      s.date,
      s.start_time,
      s.end_time,
      c.name as course_name,
      co.name as coach_name
    FROM bookings b
    JOIN schedules s ON b.schedule_id = s.id
    JOIN courses c ON s.course_id = c.id
    JOIN coaches co ON s.coach_id = co.id
    WHERE b.member_id = ?
    ORDER BY s.date DESC, s.start_time DESC`,
    [id],
    (err, rows) => {
      if (err) {
        console.error('获取会员预约历史失败:', err);
        res.status(500).json({ error: '获取会员预约历史失败' });
        return;
      }
      res.json(rows);
    }
  );
});

module.exports = router;

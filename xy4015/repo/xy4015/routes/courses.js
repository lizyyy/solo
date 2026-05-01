const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { validateCourse } = require('../utils/validators');

router.get('/', (req, res) => {
  db.all(`SELECT * FROM courses ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      console.error('获取课程列表失败:', err);
      res.status(500).json({ error: '获取课程列表失败' });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM courses WHERE id = ?`, [id], (err, course) => {
    if (err) {
      console.error('获取课程信息失败:', err);
      res.status(500).json({ error: '获取课程信息失败' });
      return;
    }
    
    if (!course) {
      res.status(404).json({ error: '课程不存在' });
      return;
    }
    
    res.json(course);
  });
});

router.post('/', (req, res) => {
  const errors = validateCourse(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { name, description, duration = 60 } = req.body;
  
  db.run(
    `INSERT INTO courses (name, description, duration) VALUES (?, ?, ?)`,
    [name, description, duration],
    function (err) {
      if (err) {
        console.error('添加课程失败:', err);
        res.status(500).json({ error: '添加课程失败' });
        return;
      }
      
      res.status(201).json({
        id: this.lastID,
        name,
        description,
        duration
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const errors = validateCourse(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { name, description, duration } = req.body;
  
  db.run(
    `UPDATE courses SET name = ?, description = ?, duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, description, duration, id],
    function (err) {
      if (err) {
        console.error('更新课程失败:', err);
        res.status(500).json({ error: '更新课程失败' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '课程不存在' });
        return;
      }
      
      res.json({
        id,
        name,
        description,
        duration
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT COUNT(*) as count FROM schedules WHERE course_id = ?`, [id], (err, result) => {
    if (err) {
      console.error('检查课程排班记录失败:', err);
      res.status(500).json({ error: '检查课程排班记录失败' });
      return;
    }
    
    if (result.count > 0) {
      res.status(400).json({ error: '该课程有排班记录，无法删除' });
      return;
    }
    
    db.run(`DELETE FROM courses WHERE id = ?`, [id], function (err) {
      if (err) {
        console.error('删除课程失败:', err);
        res.status(500).json({ error: '删除课程失败' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '课程不存在' });
        return;
      }
      
      res.json({ message: '课程已删除' });
    });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');

router.post('/', async (req, res, next) => {
  try {
    const { name, grade, class_name, parent_name, parent_phone } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { message: '学生姓名不能为空' }
      });
    }
    
    const existing = await get(
      'SELECT * FROM students WHERE name = ? AND parent_phone = ?',
      [name, parent_phone]
    );
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: '该学生已存在' }
      });
    }
    
    const result = await run(
      `INSERT INTO students (name, grade, class_name, parent_name, parent_phone)
       VALUES (?, ?, ?, ?, ?)`,
      [name, grade, class_name, parent_name, parent_phone]
    );
    
    const student = await get('SELECT * FROM students WHERE id = ?', [result.id]);
    
    res.status(201).json({
      success: true,
      data: student
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, name } = req.query;
    let sql = 'SELECT * FROM students WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    
    const students = await all(sql, params);
    
    res.json({
      success: true,
      data: students
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const student = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: { message: '学生不存在' }
      });
    }
    
    res.json({
      success: true,
      data: student
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', async (req, res, next) => {
  try {
    const { status, changed_by, reason } = req.body;
    const { id } = req.params;
    
    const student = await get('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: { message: '学生不存在' }
      });
    }
    
    const oldStatus = student.status;
    
    await run('UPDATE students SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    
    await run(
      `INSERT INTO status_history (record_type, record_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['student', id, oldStatus, status, changed_by, reason]
    );
    
    const updated = await get('SELECT * FROM students WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

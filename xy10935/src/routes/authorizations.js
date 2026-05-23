const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');

router.post('/', async (req, res, next) => {
  try {
    const { student_id, guardian_id, date, start_time, end_time, created_by } = req.body;
    
    if (!student_id || !guardian_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: { message: '必填字段不能为空' }
      });
    }
    
    const student = await get('SELECT * FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: { message: '学生不存在' }
      });
    }
    
    const guardian = await get('SELECT * FROM guardians WHERE id = ?', [guardian_id]);
    if (!guardian) {
      return res.status(404).json({
        success: false,
        error: { message: '接送人不存在' }
      });
    }
    
    const existing = await get(
      `SELECT * FROM authorization_slots 
       WHERE student_id = ? AND guardian_id = ? AND date = ? 
       AND start_time = ? AND end_time = ? AND status = 'valid'`,
      [student_id, guardian_id, date, start_time, end_time]
    );
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: '该授权时段已存在' }
      });
    }
    
    const result = await run(
      `INSERT INTO authorization_slots (student_id, guardian_id, date, start_time, end_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, guardian_id, date, start_time, end_time, created_by]
    );
    
    const auth = await get('SELECT * FROM authorization_slots WHERE id = ?', [result.id]);
    
    res.status(201).json({
      success: true,
      data: auth
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { student_id, guardian_id, date, status } = req.query;
    let sql = `
      SELECT a.*, s.name as student_name, g.name as guardian_name 
      FROM authorization_slots a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN guardians g ON a.guardian_id = g.id
      WHERE 1=1
    `;
    const params = [];
    
    if (student_id) {
      sql += ' AND a.student_id = ?';
      params.push(student_id);
    }
    
    if (guardian_id) {
      sql += ' AND a.guardian_id = ?';
      params.push(guardian_id);
    }
    
    if (date) {
      sql += ' AND a.date = ?';
      params.push(date);
    }
    
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    
    const authorizations = await all(sql, params);
    
    res.json({
      success: true,
      data: authorizations
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', async (req, res, next) => {
  try {
    const { status, changed_by, reason } = req.body;
    const { id } = req.params;
    
    const auth = await get('SELECT * FROM authorization_slots WHERE id = ?', [id]);
    if (!auth) {
      return res.status(404).json({
        success: false,
        error: { message: '授权记录不存在' }
      });
    }
    
    const oldStatus = auth.status;
    
    await run('UPDATE authorization_slots SET status = ? WHERE id = ?', [status, id]);
    
    await run(
      `INSERT INTO status_history (record_type, record_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['authorization', id, oldStatus, status, changed_by, reason]
    );
    
    const updated = await get('SELECT * FROM authorization_slots WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

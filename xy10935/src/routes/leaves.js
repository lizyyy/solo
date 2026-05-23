const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');

router.post('/', async (req, res, next) => {
  try {
    const { student_id, date, leave_type, reason } = req.body;
    
    if (!student_id || !date || !leave_type) {
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
    
    const existing = await get(
      'SELECT * FROM leave_records WHERE student_id = ? AND date = ?',
      [student_id, date]
    );
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: '该学生今日已有请假记录' }
      });
    }
    
    const result = await run(
      `INSERT INTO leave_records (student_id, date, leave_type, reason)
       VALUES (?, ?, ?, ?)`,
      [student_id, date, leave_type, reason]
    );
    
    const leave = await get('SELECT * FROM leave_records WHERE id = ?', [result.id]);
    
    res.status(201).json({
      success: true,
      data: leave
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { student_id, date, status } = req.query;
    let sql = `
      SELECT l.*, s.name as student_name 
      FROM leave_records l
      LEFT JOIN students s ON l.student_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (student_id) {
      sql += ' AND l.student_id = ?';
      params.push(student_id);
    }
    
    if (date) {
      sql += ' AND l.date = ?';
      params.push(date);
    }
    
    if (status) {
      sql += ' AND l.status = ?';
      params.push(status);
    }
    
    const leaves = await all(sql, params);
    
    res.json({
      success: true,
      data: leaves
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/approve', async (req, res, next) => {
  try {
    const { approved_by } = req.body;
    const { id } = req.params;
    
    const leave = await get('SELECT * FROM leave_records WHERE id = ?', [id]);
    if (!leave) {
      return res.status(404).json({
        success: false,
        error: { message: '请假记录不存在' }
      });
    }
    
    if (leave.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: { message: '该请假已批准' }
      });
    }
    
    const oldStatus = leave.status;
    
    await run(
      'UPDATE leave_records SET status = "approved", approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [approved_by, id]
    );
    
    await run(
      `INSERT INTO status_history (record_type, record_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['leave', id, oldStatus, 'approved', approved_by, '审批通过']
    );
    
    const updated = await get('SELECT * FROM leave_records WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/reject', async (req, res, next) => {
  try {
    const { approved_by, reason } = req.body;
    const { id } = req.params;
    
    const leave = await get('SELECT * FROM leave_records WHERE id = ?', [id]);
    if (!leave) {
      return res.status(404).json({
        success: false,
        error: { message: '请假记录不存在' }
      });
    }
    
    const oldStatus = leave.status;
    
    await run(
      'UPDATE leave_records SET status = "rejected", approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [approved_by, id]
    );
    
    await run(
      `INSERT INTO status_history (record_type, record_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['leave', id, oldStatus, 'rejected', approved_by, reason || '审批拒绝']
    );
    
    const updated = await get('SELECT * FROM leave_records WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

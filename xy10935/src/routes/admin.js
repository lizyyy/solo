const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');

router.get('/exceptions', async (req, res, next) => {
  try {
    const { is_resolved, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM exception_logs WHERE 1=1';
    const params = [];
    
    if (is_resolved !== undefined) {
      sql += ' AND is_resolved = ?';
      params.push(is_resolved ? 1 : 0);
    }
    
    if (start_date) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const exceptions = await all(sql, params);
    
    res.json({
      success: true,
      data: exceptions
    });
  } catch (err) {
    next(err);
  }
});

router.put('/exceptions/:id/resolve', async (req, res, next) => {
  try {
    const { resolution_notes, handled_by } = req.body;
    const { id } = req.params;
    
    const exception = await get('SELECT * FROM exception_logs WHERE id = ?', [id]);
    if (!exception) {
      return res.status(404).json({
        success: false,
        error: { message: '异常记录不存在' }
      });
    }
    
    await run(
      'UPDATE exception_logs SET is_resolved = 1, resolution_notes = ?, handled_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [resolution_notes, handled_by, id]
    );
    
    const updated = await get('SELECT * FROM exception_logs WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

router.post('/corrections', async (req, res, next) => {
  try {
    const { record_type, record_id, field_name, old_value, new_value, reason, corrected_by } = req.body;
    
    if (!record_type || !record_id || !field_name || !new_value || !reason || !corrected_by) {
      return res.status(400).json({
        success: false,
        error: { message: '必填字段不能为空' }
      });
    }
    
    const validRecordTypes = ['student', 'guardian', 'authorization', 'leave', 'late_pickup', 'pickup'];
    if (!validRecordTypes.includes(record_type)) {
      return res.status(400).json({
        success: false,
        error: { message: '无效的记录类型' }
      });
    }
    
    let tableName;
    switch (record_type) {
      case 'student': tableName = 'students'; break;
      case 'guardian': tableName = 'guardians'; break;
      case 'authorization': tableName = 'authorization_slots'; break;
      case 'leave': tableName = 'leave_records'; break;
      case 'late_pickup': tableName = 'late_pickup_events'; break;
      case 'pickup': tableName = 'pickup_records'; break;
    }
    
    const record = await get(`SELECT * FROM ${tableName} WHERE id = ?`, [record_id]);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: { message: '记录不存在' }
      });
    }
    
    if (!(field_name in record)) {
      return res.status(400).json({
        success: false,
        error: { message: '字段不存在' }
      });
    }
    
    const currentOldValue = record[field_name];
    
    await run(
      `UPDATE ${tableName} SET ${field_name} = ? WHERE id = ?`,
      [new_value, record_id]
    );
    
    const correctionResult = await run(
      `INSERT INTO manual_corrections (record_type, record_id, field_name, old_value, new_value, reason, corrected_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [record_type, record_id, field_name, currentOldValue, new_value, reason, corrected_by]
    );
    
    const correction = await get('SELECT * FROM manual_corrections WHERE id = ?', [correctionResult.id]);
    
    res.status(201).json({
      success: true,
      data: correction
    });
  } catch (err) {
    next(err);
  }
});

router.get('/corrections', async (req, res, next) => {
  try {
    const { record_type, record_id, corrected_by } = req.query;
    let sql = 'SELECT * FROM manual_corrections WHERE 1=1';
    const params = [];
    
    if (record_type) {
      sql += ' AND record_type = ?';
      params.push(record_type);
    }
    
    if (record_id) {
      sql += ' AND record_id = ?';
      params.push(record_id);
    }
    
    if (corrected_by) {
      sql += ' AND corrected_by = ?';
      params.push(corrected_by);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const corrections = await all(sql, params);
    
    res.json({
      success: true,
      data: corrections
    });
  } catch (err) {
    next(err);
  }
});

router.get('/status-history', async (req, res, next) => {
  try {
    const { record_type, record_id } = req.query;
    let sql = 'SELECT * FROM status_history WHERE 1=1';
    const params = [];
    
    if (record_type) {
      sql += ' AND record_type = ?';
      params.push(record_type);
    }
    
    if (record_id) {
      sql += ' AND record_id = ?';
      params.push(record_id);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const history = await all(sql, params);
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

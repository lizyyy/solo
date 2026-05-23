const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');
const { validatePickup, calculateLateFee } = require('../services/validationService');
const { logException } = require('../middleware/exceptionHandler');

router.post('/', async (req, res, next) => {
  try {
    const { student_id, guardian_id, date, pickup_time, verified_by, notes, scheduled_time } = req.body;
    
    if (!student_id || !guardian_id || !date || !pickup_time) {
      return res.status(400).json({
        success: false,
        error: { message: '必填字段不能为空' }
      });
    }
    
    const validation = await validatePickup(student_id, guardian_id, date, pickup_time);
    
    if (!validation.isValid) {
      await logException(req, new Error(validation.errors.join(', ')), '接送验证失败');
      
      return res.status(400).json({
        success: false,
        error: { 
          message: '接送验证失败',
          details: validation.errors
        }
      });
    }
    
    let lateEvent = null;
    if (scheduled_time) {
      const lateCalc = calculateLateFee(scheduled_time, pickup_time);
      if (lateCalc.lateMinutes > 0) {
        const lateResult = await run(
          `INSERT INTO late_pickup_events (student_id, guardian_id, date, scheduled_time, actual_time, late_minutes, fee_amount, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [student_id, guardian_id, date, scheduled_time, pickup_time, lateCalc.lateMinutes, lateCalc.feeAmount, notes]
        );
        lateEvent = await get('SELECT * FROM late_pickup_events WHERE id = ?', [lateResult.id]);
      }
    }
    
    const result = await run(
      `INSERT INTO pickup_records (student_id, guardian_id, authorization_id, date, pickup_time, verified_by, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [student_id, guardian_id, validation.authorization?.id, date, pickup_time, verified_by, notes]
    );
    
    const pickup = await get(`
      SELECT p.*, s.name as student_name, g.name as guardian_name
      FROM pickup_records p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN guardians g ON p.guardian_id = g.id
      WHERE p.id = ?
    `, [result.id]);
    
    res.status(201).json({
      success: true,
      data: {
        pickup,
        late_event: lateEvent
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { student_id, date, start_date, end_date } = req.query;
    let sql = `
      SELECT p.*, s.name as student_name, g.name as guardian_name
      FROM pickup_records p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN guardians g ON p.guardian_id = g.id
      WHERE 1=1
    `;
    const params = [];
    
    if (student_id) {
      sql += ' AND p.student_id = ?';
      params.push(student_id);
    }
    
    if (date) {
      sql += ' AND p.date = ?';
      params.push(date);
    }
    
    if (start_date && end_date) {
      sql += ' AND p.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    sql += ' ORDER BY p.date DESC, p.pickup_time DESC';
    
    const pickups = await all(sql, params);
    
    res.json({
      success: true,
      data: pickups
    });
  } catch (err) {
    next(err);
  }
});

router.get('/late', async (req, res, next) => {
  try {
    const { student_id, date, start_date, end_date, fee_status } = req.query;
    let sql = `
      SELECT l.*, s.name as student_name, g.name as guardian_name
      FROM late_pickup_events l
      LEFT JOIN students s ON l.student_id = s.id
      LEFT JOIN guardians g ON l.guardian_id = g.id
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
    
    if (start_date && end_date) {
      sql += ' AND l.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    if (fee_status) {
      sql += ' AND l.fee_status = ?';
      params.push(fee_status);
    }
    
    sql += ' ORDER BY l.date DESC';
    
    const lateEvents = await all(sql, params);
    
    res.json({
      success: true,
      data: lateEvents
    });
  } catch (err) {
    next(err);
  }
});

router.put('/late/:id/fee-status', async (req, res, next) => {
  try {
    const { fee_status, updated_by } = req.body;
    const { id } = req.params;
    
    const lateEvent = await get('SELECT * FROM late_pickup_events WHERE id = ?', [id]);
    if (!lateEvent) {
      return res.status(404).json({
        success: false,
        error: { message: '迟接记录不存在' }
      });
    }
    
    await run(
      'UPDATE late_pickup_events SET fee_status = ? WHERE id = ?',
      [fee_status, id]
    );
    
    await run(
      `INSERT INTO status_history (record_type, record_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['late_pickup', id, lateEvent.fee_status, fee_status, updated_by, '更新费用状态']
    );
    
    const updated = await get('SELECT * FROM late_pickup_events WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { all } = require('../db');
const { Parser } = require('json2csv');

router.get('/daily', async (req, res, next) => {
  try {
    const { date, format = 'json' } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: { message: '日期不能为空' }
      });
    }
    
    const pickups = await all(`
      SELECT 
        p.id,
        p.date,
        p.pickup_time,
        s.name as student_name,
        s.grade,
        s.class_name,
        s.parent_name,
        s.parent_phone,
        g.name as guardian_name,
        g.relation,
        g.phone as guardian_phone,
        p.status,
        p.verified_by,
        p.notes
      FROM pickup_records p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN guardians g ON p.guardian_id = g.id
      WHERE p.date = ?
      ORDER BY p.pickup_time
    `, [date]);
    
    const lateEvents = await all(`
      SELECT 
        l.id,
        l.date,
        l.scheduled_time,
        l.actual_time,
        l.late_minutes,
        l.fee_amount,
        l.fee_status,
        s.name as student_name,
        g.name as guardian_name
      FROM late_pickup_events l
      LEFT JOIN students s ON l.student_id = s.id
      LEFT JOIN guardians g ON l.guardian_id = g.id
      WHERE l.date = ?
    `, [date]);
    
    const leaves = await all(`
      SELECT 
        l.id,
        l.date,
        l.leave_type,
        l.reason,
        l.status,
        s.name as student_name
      FROM leave_records l
      LEFT JOIN students s ON l.student_id = s.id
      WHERE l.date = ? AND l.status = 'approved'
    `, [date]);
    
    const report = {
      date,
      generated_at: new Date().toISOString(),
      summary: {
        total_pickups: pickups.length,
        total_late: lateEvents.length,
        total_leaves: leaves.length,
        total_fee: lateEvents.reduce((sum, l) => sum + l.fee_amount, 0)
      },
      pickups,
      late_events: lateEvents,
      leaves
    };
    
    if (format === 'csv') {
      const pickupFields = ['date', 'student_name', 'grade', 'class_name', 'guardian_name', 'relation', 'pickup_time', 'verified_by', 'notes'];
      const json2csvParser = new Parser({ fields: pickupFields });
      const csv = json2csvParser.parse(pickups);
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`daily-pickup-report-${date}.csv`);
      return res.send(csv);
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    next(err);
  }
});

router.get('/monthly', async (req, res, next) => {
  try {
    const { year, month, format = 'json' } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: { message: '年和月不能为空' }
      });
    }
    
    const datePattern = `${year}-${month.padStart(2, '0')}`;
    
    const pickups = await all(`
      SELECT 
        p.date,
        COUNT(*) as pickup_count,
        COUNT(l.id) as late_count,
        COALESCE(SUM(l.fee_amount), 0) as total_fee
      FROM pickup_records p
      LEFT JOIN late_pickup_events l ON p.student_id = l.student_id AND p.date = l.date
      WHERE p.date LIKE ?
      GROUP BY p.date
      ORDER BY p.date
    `, [`${datePattern}%`]);
    
    const studentStats = await all(`
      SELECT 
        s.id,
        s.name,
        s.grade,
        s.class_name,
        COUNT(DISTINCT p.id) as pickup_days,
        COUNT(DISTINCT l.id) as late_count,
        COALESCE(SUM(l.fee_amount), 0) as total_fee
      FROM students s
      LEFT JOIN pickup_records p ON s.id = p.student_id AND p.date LIKE ?
      LEFT JOIN late_pickup_events l ON s.id = l.student_id AND l.date LIKE ?
      GROUP BY s.id
      ORDER BY pickup_days DESC
    `, [`${datePattern}%`, `${datePattern}%`]);
    
    const report = {
      year,
      month,
      generated_at: new Date().toISOString(),
      summary: {
        total_days: pickups.length,
        total_pickups: pickups.reduce((sum, d) => sum + d.pickup_count, 0),
        total_late: pickups.reduce((sum, d) => sum + d.late_count, 0),
        total_fee: pickups.reduce((sum, d) => sum + d.total_fee, 0)
      },
      daily_breakdown: pickups,
      student_stats: studentStats
    };
    
    if (format === 'csv') {
      const fields = ['date', 'pickup_count', 'late_count', 'total_fee'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(pickups);
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`monthly-pickup-report-${year}-${month}.csv`);
      return res.send(csv);
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

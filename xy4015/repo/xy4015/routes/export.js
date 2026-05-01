const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/today-bookings', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { date } = req.query;
  const targetDate = date || today;
  
  const query = `
    SELECT 
      s.id as schedule_id,
      s.date,
      s.start_time,
      s.end_time,
      c.name as course_name,
      co.name as coach_name,
      s.capacity,
      s.booked_count,
      b.id as booking_id,
      b.member_id,
      m.name as member_name,
      m.phone as member_phone,
      b.status,
      b.is_no_show,
      b.booked_at
    FROM schedules s
    JOIN courses c ON s.course_id = c.id
    JOIN coaches co ON s.coach_id = co.id
    LEFT JOIN bookings b ON s.id = b.schedule_id AND b.status = 'booked'
    LEFT JOIN members m ON b.member_id = m.id
    WHERE s.date = ?
    ORDER BY s.start_time, b.booked_at
  `;
  
  db.all(query, [targetDate], (err, rows) => {
    if (err) {
      console.error('获取预约列表失败:', err);
      res.status(500).json({ error: '获取预约列表失败' });
      return;
    }
    
    let csvContent = '课程名称,教练,日期,开始时间,结束时间,会员姓名,会员电话,预约状态,预约时间\n';
    
    rows.forEach(row => {
      if (row.member_name) {
        csvContent += [
          `"${row.course_name}"`,
          `"${row.coach_name}"`,
          row.date,
          row.start_time,
          row.end_time,
          `"${row.member_name}"`,
          row.member_phone,
          row.status,
          row.booked_at
        ].join(',') + '\n';
      }
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=bookings_${targetDate}.csv`);
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.write('\ufeff' + csvContent);
    res.end();
  });
});

router.get('/member-history/:member_id', (req, res) => {
  const { member_id } = req.params;
  
  const query = `
    SELECT 
      m.id as member_id,
      m.name as member_name,
      m.phone as member_phone,
      m.remaining_sessions,
      b.id as booking_id,
      b.status,
      b.is_no_show,
      b.booked_at,
      b.canceled_at,
      s.date,
      s.start_time,
      s.end_time,
      c.name as course_name,
      co.name as coach_name
    FROM members m
    LEFT JOIN bookings b ON m.id = b.member_id
    LEFT JOIN schedules s ON b.schedule_id = s.id
    LEFT JOIN courses c ON s.course_id = c.id
    LEFT JOIN coaches co ON s.coach_id = co.id
    WHERE m.id = ?
    ORDER BY s.date DESC, s.start_time DESC
  `;
  
  db.all(query, [member_id], (err, rows) => {
    if (err) {
      console.error('获取会员历史失败:', err);
      res.status(500).json({ error: '获取会员历史失败' });
      return;
    }
    
    if (rows.length === 0 || !rows[0].member_name) {
      res.status(404).json({ error: '会员不存在' });
      return;
    }
    
    const memberInfo = rows[0];
    let csvContent = '会员姓名,会员电话,剩余课时\n';
    csvContent += [
      `"${memberInfo.member_name}"`,
      memberInfo.member_phone,
      memberInfo.remaining_sessions
    ].join(',') + '\n\n';
    
    csvContent += '课程名称,教练,日期,开始时间,结束时间,预约状态,是否爽约,预约时间,取消时间\n';
    
    rows.forEach(row => {
      if (row.course_name) {
        csvContent += [
          `"${row.course_name}"`,
          `"${row.coach_name}"`,
          row.date,
          row.start_time,
          row.end_time,
          row.status,
          row.is_no_show ? '是' : '否',
          row.booked_at || '',
          row.canceled_at || ''
        ].join(',') + '\n';
      }
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=member_${memberInfo.member_name}_history.csv`);
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.write('\ufeff' + csvContent);
    res.end();
  });
});

module.exports = router;

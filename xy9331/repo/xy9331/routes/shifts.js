const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function getWeekDates(baseDate) {
  const dates = [];
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - day + (day === 0 ? -6 : 1));
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

router.get('/my', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { weekOffset = 0 } = req.query;
  
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + (parseInt(weekOffset) * 7));
  
  const weekDates = getWeekDates(targetDate);
  const startDate = weekDates[0];
  const endDate = weekDates[6];

  const query = `
    SELECT s.*, u.name as user_name
    FROM shifts s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.user_id = ? AND s.date >= ? AND s.date <= ?
    ORDER BY s.date, s.start_time
  `;

  db.all(query, [userId, startDate, endDate], (err, shifts) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json({ shifts, weekDates });
  });
});

router.get('/week', authenticateToken, (req, res) => {
  const { weekOffset = 0 } = req.query;
  
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + (parseInt(weekOffset) * 7));
  
  const weekDates = getWeekDates(targetDate);
  const startDate = weekDates[0];
  const endDate = weekDates[6];

  const query = `
    SELECT s.*, u.name as user_name
    FROM shifts s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.date >= ? AND s.date <= ?
    ORDER BY s.date, s.start_time
  `;

  db.all(query, [startDate, endDate], (err, shifts) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json({ shifts, weekDates });
  });
});

router.get('/employees', authenticateToken, (req, res) => {
  const query = `
    SELECT id, name, username, role FROM users ORDER BY role DESC, name
  `;

  db.all(query, (err, users) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json({ users });
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const shiftId = req.params.id;

  const query = `
    SELECT s.*, u.name as user_name
    FROM shifts s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `;

  db.get(query, [shiftId], (err, shift) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!shift) {
      return res.status(404).json({ error: '班次不存在' });
    }
    res.json({ shift });
  });
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { user_id, date, start_time, end_time, shift_type, notes } = req.body;

  if (!user_id || !date || !start_time || !end_time) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
    return res.status(400).json({ error: '时间格式错误，应为 HH:MM' });
  }

  const query = `
    INSERT INTO shifts (user_id, date, start_time, end_time, shift_type, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [user_id, date, start_time, end_time, shift_type || 'regular', notes], function(err) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.status(201).json({ id: this.lastID, message: '班次创建成功' });
  });
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const shiftId = req.params.id;
  const { user_id, date, start_time, end_time, shift_type, notes } = req.body;

  db.get('SELECT * FROM shifts WHERE id = ?', [shiftId], (err, existingShift) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!existingShift) {
      return res.status(404).json({ error: '班次不存在' });
    }

    const updatedUserId = user_id || existingShift.user_id;
    const updatedDate = date || existingShift.date;
    const updatedStartTime = start_time || existingShift.start_time;
    const updatedEndTime = end_time || existingShift.end_time;
    const updatedShiftType = shift_type || existingShift.shift_type;
    const updatedNotes = notes !== undefined ? notes : existingShift.notes;

    const query = `
      UPDATE shifts 
      SET user_id = ?, date = ?, start_time = ?, end_time = ?, shift_type = ?, notes = ?
      WHERE id = ?
    `;

    db.run(query, [updatedUserId, updatedDate, updatedStartTime, updatedEndTime, updatedShiftType, updatedNotes, shiftId], function(err) {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      res.json({ message: '班次更新成功' });
    });
  });
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const shiftId = req.params.id;

  db.run('DELETE FROM shifts WHERE id = ?', [shiftId], function(err) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '班次不存在' });
    }
    res.json({ message: '班次删除成功' });
  });
});

module.exports = router;

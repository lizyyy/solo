const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const ExcelJS = require('exceljs');
const db = require('./db');
const { getStatistics, calculateUtilization } = require('./utils/utilization');

const router = express.Router();

router.get('/statistics', (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate || moment().subtract(7, 'days').format('YYYY-MM-DD');
  const end = endDate || moment().format('YYYY-MM-DD');

  getStatistics(start, end)
    .then(stats => res.json({ success: true, data: stats }))
    .catch(err => res.json({ success: false, error: err.message }));
});

router.get('/rooms', (req, res) => {
  db.all('SELECT * FROM meeting_rooms ORDER BY name', (err, rows) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.post('/rooms', (req, res) => {
  const { name, capacity, location } = req.body;
  const id = uuidv4();
  db.run(
    'INSERT INTO meeting_rooms (id, name, capacity, location) VALUES (?, ?, ?, ?)',
    [id, name, capacity, location],
    function(err) {
      if (err) return res.json({ success: false, error: err.message });
      res.json({ success: true, data: { id, name, capacity, location } });
    }
  );
});

router.put('/rooms/:id', (req, res) => {
  const { id } = req.params;
  const { name, capacity, location, status } = req.body;
  const modifiedBy = req.body.modifiedBy || 'admin';

  db.get('SELECT * FROM meeting_rooms WHERE id = ?', [id], (err, oldData) => {
    if (err) return res.json({ success: false, error: err.message });
    
    const fields = { name, capacity, location, status };
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && oldData[key] !== value) {
        db.run(
          'INSERT INTO modification_history (id, entity_type, entity_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), 'room', id, key, String(oldData[key]), String(value), modifiedBy]
        );
      }
    });

    db.run(
      'UPDATE meeting_rooms SET name = ?, capacity = ?, location = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, capacity, location, status, id],
      function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true, data: { id, name, capacity, location, status } });
      }
    );
  });
});

router.get('/devices', (req, res) => {
  db.all(`
    SELECT d.*, r.name as room_name 
    FROM projection_devices d 
    LEFT JOIN meeting_rooms r ON d.room_id = r.id 
    ORDER BY d.name
  `, (err, rows) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.put('/devices/:id', (req, res) => {
  const { id } = req.params;
  const { name, type, status } = req.body;
  const modifiedBy = req.body.modifiedBy || 'admin';

  db.get('SELECT * FROM projection_devices WHERE id = ?', [id], (err, oldData) => {
    if (err) return res.json({ success: false, error: err.message });
    
    const fields = { name, type, status };
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && oldData[key] !== value) {
        db.run(
          'INSERT INTO modification_history (id, entity_type, entity_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), 'device', id, key, String(oldData[key]), String(value), modifiedBy]
        );
      }
    });

    db.run(
      'UPDATE projection_devices SET name = ?, type = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, type, status, id],
      function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
      }
    );
  });
});

router.get('/bookings', (req, res) => {
  const { roomId, startDate, endDate, status } = req.query;
  let query = `
    SELECT b.*, r.name as room_name 
    FROM bookings b 
    LEFT JOIN meeting_rooms r ON b.room_id = r.id 
    WHERE 1=1
  `;
  const params = [];

  if (roomId) {
    query += ' AND b.room_id = ?';
    params.push(roomId);
  }
  if (startDate) {
    query += ' AND b.start_time >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND b.end_time <= ?';
    params.push(endDate);
  }
  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }
  query += ' ORDER BY b.start_time DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.post('/bookings', (req, res) => {
  const { room_id, user_name, title, start_time, end_time, attendees, needs_projector } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO bookings (id, room_id, user_name, title, start_time, end_time, attendees, needs_projector) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, room_id, user_name, title, start_time, end_time, attendees, needs_projector || 0],
    function(err) {
      if (err) return res.json({ success: false, error: err.message });
      res.json({ success: true, data: { id, ...req.body } });
    }
  );
});

router.put('/bookings/:id', (req, res) => {
  const { id } = req.params;
  const modifiedBy = req.body.modifiedBy || 'admin';

  db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, oldData) => {
    if (err) return res.json({ success: false, error: err.message });
    
    const fields = ['room_id', 'user_name', 'title', 'start_time', 'end_time', 'attendees', 'needs_projector', 'status'];
    fields.forEach(key => {
      if (req.body[key] !== undefined && oldData[key] !== req.body[key]) {
        db.run(
          'INSERT INTO modification_history (id, entity_type, entity_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), 'booking', id, key, String(oldData[key]), String(req.body[key]), modifiedBy]
        );
      }
    });

    const { room_id, user_name, title, start_time, end_time, attendees, needs_projector, status } = req.body;
    db.run(
      'UPDATE bookings SET room_id = ?, user_name = ?, title = ?, start_time = ?, end_time = ?, attendees = ?, needs_projector = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [room_id, user_name, title, start_time, end_time, attendees, needs_projector, status, id],
      function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
      }
    );
  });
});

router.post('/bookings/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason, cancelled_by } = req.body;

  db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, booking) => {
    if (err) return res.json({ success: false, error: err.message });
    if (!booking) return res.json({ success: false, error: '预订不存在' });

    const releasedHours = moment(booking.end_time).diff(moment(booking.start_time), 'hours', true);
    
    db.run(
      'INSERT INTO cancellations (id, booking_id, reason, cancelled_by, released_hours) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), id, reason, cancelled_by, releasedHours],
      function(err) {
        if (err) return res.json({ success: false, error: err.message });
        
        db.run('UPDATE bookings SET status = "cancelled" WHERE id = ?', [id], (err) => {
          if (err) return res.json({ success: false, error: err.message });
          res.json({ success: true });
        });
      }
    );
  });
});

router.get('/tea-services', (req, res) => {
  const { status, handler } = req.query;
  let query = `
    SELECT t.*, b.title as booking_title, r.name as room_name
    FROM tea_services t
    LEFT JOIN bookings b ON t.booking_id = b.id
    LEFT JOIN meeting_rooms r ON b.room_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (handler) {
    query += ' AND t.handler = ?';
    params.push(handler);
  }
  query += ' ORDER BY t.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.put('/tea-services/:id', (req, res) => {
  const { id } = req.params;
  const { type, quantity, status, handler } = req.body;
  const modifiedBy = req.body.modifiedBy || 'admin';

  db.get('SELECT * FROM tea_services WHERE id = ?', [id], (err, oldData) => {
    if (err) return res.json({ success: false, error: err.message });
    
    const fields = { type, quantity, status, handler };
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && oldData[key] !== value) {
        db.run(
          'INSERT INTO modification_history (id, entity_type, entity_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), 'tea_service', id, key, String(oldData[key]), String(value), modifiedBy]
        );
      }
    });

    const handledAt = status === 'completed' ? moment().format('YYYY-MM-DD HH:mm:ss') : oldData.handled_at;
    
    db.run(
      'UPDATE tea_services SET type = ?, quantity = ?, status = ?, handler = ?, handled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [type, quantity, status, handler, handledAt, id],
      function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
      }
    );
  });
});

router.get('/fault-tickets', (req, res) => {
  const { status, handler } = req.query;
  let query = `
    SELECT t.*, d.name as device_name, r.name as room_name
    FROM fault_tickets t
    LEFT JOIN projection_devices d ON t.device_id = d.id
    LEFT JOIN meeting_rooms r ON d.room_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (handler) {
    query += ' AND t.handler = ?';
    params.push(handler);
  }
  query += ' ORDER BY t.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.put('/fault-tickets/:id', (req, res) => {
  const { id } = req.params;
  const { status, handler, resolution } = req.body;
  const handledAt = status === 'resolved' ? moment().format('YYYY-MM-DD HH:mm:ss') : null;

  db.run(
    'UPDATE fault_tickets SET status = ?, handler = ?, resolution = ?, handled_at = ? WHERE id = ?',
    [status, handler, resolution, handledAt, id],
    function(err) {
      if (err) return res.json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

router.get('/anomalies', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM anomalies WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.put('/anomalies/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { handler, correction_before, correction_after } = req.body;

  db.run(
    'UPDATE anomalies SET status = "resolved", handler = ?, handled_at = CURRENT_TIMESTAMP, correction_before = ?, correction_after = ? WHERE id = ?',
    [handler, correction_before, correction_after, id],
    function(err) {
      if (err) return res.json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

router.get('/modification-history', (req, res) => {
  const { entity_type, entity_id } = req.query;
  let query = 'SELECT * FROM modification_history WHERE 1=1';
  const params = [];

  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (entity_id) {
    query += ' AND entity_id = ?';
    params.push(entity_id);
  }
  query += ' ORDER BY modified_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

router.get('/report/export', async (req, res) => {
  const { startDate, endDate, handler, type } = req.query;
  const start = startDate || moment().subtract(30, 'days').format('YYYY-MM-DD');
  const end = endDate || moment().format('YYYY-MM-DD');

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '会议室预约系统';
    
    const worksheet1 = workbook.addWorksheet('利用率统计');
    const utilizationData = await calculateUtilization(start, end);
    worksheet1.columns = [
      { header: '会议室', key: 'room_name', width: 20 },
      { header: '预订次数', key: 'bookingCount', width: 12 },
      { header: '取消次数', key: 'cancelledCount', width: 12 },
      { header: '实际使用时长(h)', key: 'actualUsedHours', width: 18 },
      { header: '释放时长(h)', key: 'cancelledHours', width: 15 },
      { header: '利用率(%)', key: 'utilizationRate', width: 12 },
      { header: '释放率(%)', key: 'releaseRate', width: 12 },
    ];
    utilizationData.forEach(row => worksheet1.addRow(row));

    const worksheet2 = workbook.addWorksheet('茶水服务记录');
    const teaData = await new Promise((resolve, reject) => {
      let query = `
        SELECT t.*, b.title as booking_title, b.user_name as booker, r.name as room_name
        FROM tea_services t
        LEFT JOIN bookings b ON t.booking_id = b.id
        LEFT JOIN meeting_rooms r ON b.room_id = r.id
        WHERE t.created_at >= ? AND t.created_at <= ?
      `;
      const params = [start + ' 00:00:00', end + ' 23:59:59'];
      if (handler) {
        query += ' AND t.handler = ?';
        params.push(handler);
      }
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
    worksheet2.columns = [
      { header: '会议标题', key: 'booking_title', width: 25 },
      { header: '预订人', key: 'booker', width: 15 },
      { header: '会议室', key: 'room_name', width: 15 },
      { header: '服务类型', key: 'type', width: 12 },
      { header: '数量', key: 'quantity', width: 8 },
      { header: '状态', key: 'status', width: 10 },
      { header: '处理人', key: 'handler', width: 12 },
      { header: '处理时间', key: 'handled_at', width: 20 },
    ];
    teaData.forEach(row => worksheet2.addRow(row));

    const worksheet3 = workbook.addWorksheet('故障工单');
    const ticketData = await new Promise((resolve, reject) => {
      let query = `
        SELECT t.*, d.name as device_name, r.name as room_name
        FROM fault_tickets t
        LEFT JOIN projection_devices d ON t.device_id = d.id
        LEFT JOIN meeting_rooms r ON d.room_id = r.id
        WHERE t.created_at >= ? AND t.created_at <= ?
      `;
      const params = [start + ' 00:00:00', end + ' 23:59:59'];
      if (handler) {
        query += ' AND t.handler = ?';
        params.push(handler);
      }
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
    worksheet3.columns = [
      { header: '设备名称', key: 'device_name', width: 20 },
      { header: '所属会议室', key: 'room_name', width: 15 },
      { header: '报告人', key: 'reporter', width: 12 },
      { header: '问题描述', key: 'description', width: 30 },
      { header: '状态', key: 'status', width: 10 },
      { header: '处理人', key: 'handler', width: 12 },
      { header: '处理时间', key: 'handled_at', width: 20 },
      { header: '解决方案', key: 'resolution', width: 30 },
    ];
    ticketData.forEach(row => worksheet3.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=meeting-room-report-${moment().format('YYYYMMDD')}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;

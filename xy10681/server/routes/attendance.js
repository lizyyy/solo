const moment = require('moment');

module.exports = (app, db) => {
  const addAuditLog = (module, recordId, field, oldVal, newVal, operator, operation) => {
    db.run(`INSERT INTO audit_logs (module, record_id, field_name, old_value, new_value, operation, operator) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [module, recordId, field, oldVal, newVal, operation, operator]);
  };

  const addTimeline = (volunteerId, action, description, operator, status, relatedId, relatedType) => {
    db.run(`INSERT INTO timeline (volunteer_id, action, description, operator, status, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [volunteerId, action, description, operator, status, relatedId, relatedType]);
  };

  app.get('/api/attendance', (req, res) => {
    const { volunteer_id, status } = req.query;
    let sql = `SELECT * FROM attendance WHERE 1=1`;
    let params = [];
    
    if (volunteer_id) {
      sql += ` AND volunteer_id = ?`;
      params.push(volunteer_id);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;
    
    db.all(sql, params, (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });

  app.get('/api/attendance/:id', (req, res) => {
    db.get(`SELECT * FROM attendance WHERE id = ?`, [req.params.id], (err, row) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(row);
    });
  });

  app.post('/api/attendance', (req, res) => {
    const { volunteer_id, volunteer_name, shift_id, operator } = req.body;
    db.run(`INSERT INTO attendance (volunteer_id, volunteer_name, shift_id, created_by) VALUES (?, ?, ?, ?)`,
      [volunteer_id, volunteer_name, shift_id, operator],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const recordId = this.lastID;
          addTimeline(volunteer_id, '创建考勤记录', '创建考勤记录', operator, '待签到', recordId, 'attendance');
          res.json({ id: recordId, message: '创建成功' });
        }
      });
  });

  app.post('/api/attendance/:id/check-in', (req, res) => {
    const { check_in_time, check_in_location, operator } = req.body;
    db.get(`SELECT * FROM attendance WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE attendance SET check_in_time = ?, check_in_location = ?, status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [check_in_time, check_in_location, '已签到', operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('attendance', req.params.id, 'check_in_time', null, check_in_time, operator, '签到');
              addTimeline(oldRecord.volunteer_id, '签到', `签到时间:${check_in_time}`, operator, '已签到', req.params.id, 'attendance');
              res.json({ success: true, message: '签到成功' });
            }
          });
      }
    });
  });

  app.post('/api/attendance/:id/check-out', (req, res) => {
    const { check_out_time, check_out_location, operator } = req.body;
    db.get(`SELECT * FROM attendance WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE attendance SET check_out_time = ?, check_out_location = ?, status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [check_out_time, check_out_location, '已签退', operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('attendance', req.params.id, 'check_out_time', null, check_out_time, operator, '签退');
              addTimeline(oldRecord.volunteer_id, '签退', `签退时间:${check_out_time}`, operator, '已签退', req.params.id, 'attendance');
              res.json({ success: true, message: '签退成功' });
            }
          });
      }
    });
  });

  app.put('/api/attendance/:id/status', (req, res) => {
    const { status, operator, remarks } = req.body;
    db.get(`SELECT * FROM attendance WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE attendance SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [status, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('attendance', req.params.id, 'status', oldRecord.status, status, operator, '状态变更');
              addTimeline(oldRecord.volunteer_id, '考勤状态变更', `考勤状态变更为${status}`, operator, status, req.params.id, 'attendance');
              res.json({ success: true, message: '状态更新成功' });
            }
          });
      }
    });
  });

  app.get('/api/attendance/:id/audit-logs', (req, res) => {
    db.all(`SELECT * FROM audit_logs WHERE module = 'attendance' AND record_id = ? ORDER BY operate_time DESC`, [req.params.id], (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });
};

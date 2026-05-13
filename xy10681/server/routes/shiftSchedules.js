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

  app.get('/api/shift-schedules', (req, res) => {
    const { volunteer_id, shift_date, status } = req.query;
    let sql = `SELECT * FROM shift_schedules WHERE 1=1`;
    let params = [];
    
    if (volunteer_id) {
      sql += ` AND volunteer_id = ?`;
      params.push(volunteer_id);
    }
    if (shift_date) {
      sql += ` AND shift_date = ?`;
      params.push(shift_date);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY shift_date DESC, start_time ASC`;
    
    db.all(sql, params, (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });

  app.get('/api/shift-schedules/:id', (req, res) => {
    db.get(`SELECT * FROM shift_schedules WHERE id = ?`, [req.params.id], (err, row) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(row);
    });
  });

  app.post('/api/shift-schedules', (req, res) => {
    const { volunteer_id, volunteer_name, shift_date, start_time, end_time, shift_type, location, operator } = req.body;
    db.run(`INSERT INTO shift_schedules (volunteer_id, volunteer_name, shift_date, start_time, end_time, shift_type, location, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [volunteer_id, volunteer_name, shift_date, start_time, end_time, shift_type, location, operator],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const recordId = this.lastID;
          addTimeline(volunteer_id, '创建排班', `${shift_date} ${start_time}-${end_time}排班`, operator, '已排班', recordId, 'shift_schedule');
          res.json({ id: recordId, message: '创建成功' });
        }
      });
  });

  app.put('/api/shift-schedules/:id/status', (req, res) => {
    const { status, operator } = req.body;
    db.get(`SELECT * FROM shift_schedules WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE shift_schedules SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [status, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('shift_schedules', req.params.id, 'status', oldRecord.status, status, operator, '状态变更');
              addTimeline(oldRecord.volunteer_id, '排班状态变更', `排班状态变更为${status}`, operator, status, req.params.id, 'shift_schedule');
              res.json({ success: true, message: '状态更新成功' });
            }
          });
      }
    });
  });

  app.put('/api/shift-schedules/:id', (req, res) => {
    const { shift_date, start_time, end_time, shift_type, location, operator } = req.body;
    db.get(`SELECT * FROM shift_schedules WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE shift_schedules SET shift_date = ?, start_time = ?, end_time = ?, shift_type = ?, location = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [shift_date, start_time, end_time, shift_type, location, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              const fields = ['shift_date', 'start_time', 'end_time', 'shift_type', 'location'];
              fields.forEach(field => {
                if (oldRecord[field] !== req.body[field]) {
                  addAuditLog('shift_schedules', req.params.id, field, oldRecord[field], req.body[field], operator, '修改');
                }
              });
              addTimeline(oldRecord.volunteer_id, '更新排班信息', `更新排班信息`, operator, oldRecord.status, req.params.id, 'shift_schedule');
              res.json({ success: true, message: '更新成功' });
            }
          });
      }
    });
  });

  app.get('/api/shift-schedules/:id/audit-logs', (req, res) => {
    db.all(`SELECT * FROM audit_logs WHERE module = 'shift_schedules' AND record_id = ? ORDER BY operate_time DESC`, [req.params.id], (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });
};

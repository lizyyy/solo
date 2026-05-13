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

  app.get('/api/exceptions', (req, res) => {
    const { volunteer_id, status, exception_type } = req.query;
    let sql = `SELECT * FROM exception_list WHERE 1=1`;
    let params = [];
    
    if (volunteer_id) {
      sql += ` AND volunteer_id = ?`;
      params.push(volunteer_id);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (exception_type) {
      sql += ` AND exception_type = ?`;
      params.push(exception_type);
    }
    sql += ` ORDER BY created_at DESC`;
    
    db.all(sql, params, (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });

  app.post('/api/exceptions', (req, res) => {
    const { volunteer_id, volunteer_name, exception_type, description, related_id, related_type, operator } = req.body;
    db.run(`INSERT INTO exception_list (volunteer_id, volunteer_name, exception_type, description, related_id, related_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [volunteer_id, volunteer_name, exception_type, description, related_id, related_type, operator],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const recordId = this.lastID;
          addTimeline(volunteer_id, '创建异常记录', `${exception_type}: ${description}`, operator, '待处理', recordId, 'exception');
          res.json({ id: recordId, message: '创建成功' });
        }
      });
  });

  app.put('/api/exceptions/:id/handle', (req, res) => {
    const { handled_by, handler_remark } = req.body;
    db.get(`SELECT * FROM exception_list WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE exception_list SET status = ?, handled_by = ?, handled_at = ?, handler_remark = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          ['已处理', handled_by, moment().format('YYYY-MM-DD HH:mm:ss'), handler_remark, handled_by, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('exception_list', req.params.id, 'status', oldRecord.status, '已处理', handled_by, '处理');
              addTimeline(oldRecord.volunteer_id, '处理异常', `${oldRecord.exception_type} 已处理`, handled_by, '已处理', req.params.id, 'exception');
              res.json({ success: true, message: '异常处理成功' });
            }
          });
      }
    });
  });

  app.put('/api/exceptions/:id/review', (req, res) => {
    const { operator, review_result, review_remark } = req.body;
    db.get(`SELECT * FROM exception_list WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        const newStatus = review_result === 'pass' ? '复核通过' : '复核驳回';
        db.run(`UPDATE exception_list SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [newStatus, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('exception_list', req.params.id, 'status', oldRecord.status, newStatus, operator, '复核');
              addTimeline(oldRecord.volunteer_id, '复核异常', `${oldRecord.exception_type} ${newStatus}`, operator, newStatus, req.params.id, 'exception');
              res.json({ success: true, message: '复核完成' });
            }
          });
      }
    });
  });
};

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

  app.get('/api/subsidy-rules', (req, res) => {
    db.all(`SELECT * FROM subsidy_rules ORDER BY created_at DESC`, (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });

  app.post('/api/subsidy-rules', (req, res) => {
    const { rule_name, rule_type, amount, conditions, effective_date, expiry_date, operator } = req.body;
    db.run(`INSERT INTO subsidy_rules (rule_name, rule_type, amount, conditions, effective_date, expiry_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rule_name, rule_type, amount, conditions, effective_date, expiry_date, operator],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ id: this.lastID, message: '创建成功' });
      });
  });

  app.get('/api/subsidy-records', (req, res) => {
    const { volunteer_id, status } = req.query;
    let sql = `SELECT * FROM subsidy_records WHERE 1=1`;
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

  app.post('/api/subsidy-records', (req, res) => {
    const { volunteer_id, volunteer_name, rule_id, rule_name, amount, shift_id, attendance_id, callback_id, operator, remarks } = req.body;
    
    db.get(`SELECT * FROM subsidy_records WHERE callback_id = ?`, [callback_id], (err, existing) => {
      if (err) res.status(500).json({ error: err.message });
      else if (existing) {
        return res.status(400).json({ error: '重复回调，该补贴已发放', existing_record: existing });
      } else {
        db.get(`SELECT * FROM material_packages WHERE volunteer_id = ? AND distributed = 0`, [volunteer_id], (err, packages) => {
          if (packages) {
            return res.status(400).json({ error: '存在未发放物资包，已拦截补贴发放' });
          }
          
          db.run(`INSERT INTO subsidy_records (volunteer_id, volunteer_name, rule_id, rule_name, amount, shift_id, attendance_id, callback_id, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [volunteer_id, volunteer_name, rule_id, rule_name, amount, shift_id, attendance_id, callback_id, remarks, operator],
            function(err) {
              if (err) res.status(500).json({ error: err.message });
              else {
                const recordId = this.lastID;
                addAuditLog('subsidy_records', recordId, 'amount', null, amount, operator, '创建补贴');
                addTimeline(volunteer_id, '创建补贴记录', `${rule_name} 补贴 ${amount}元`, operator, '待发放', recordId, 'subsidy_record');
                res.json({ id: recordId, message: '补贴记录创建成功' });
              }
            });
        });
      }
    });
  });

  app.post('/api/subsidy-records/callback', (req, res) => {
    const { callback_id, volunteer_id, volunteer_name, rule_id, rule_name, amount, operator } = req.body;
    
    db.get(`SELECT * FROM subsidy_records WHERE callback_id = ?`, [callback_id], (err, existing) => {
      if (err) res.status(500).json({ error: err.message });
      else if (existing) {
        return res.json({ success: true, message: '回调已处理，不重复扣减', existing_record: existing });
      }
      
      db.get(`SELECT * FROM material_packages WHERE volunteer_id = ? AND distributed = 0`, [volunteer_id], (err, packages) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else if (packages) {
          db.run(`INSERT INTO exception_list (volunteer_id, volunteer_name, exception_type, description, created_by) VALUES (?, ?, ?, ?, ?)`,
            [volunteer_id, volunteer_name, '物资包拦截', `补贴发放被拦截：存在未发放物资包`, operator],
            function(err2) {
              const exceptionId = this.lastID;
              addTimeline(volunteer_id, '补贴拦截', '因未发放物资包，补贴发放被拦截', operator, '已拦截', exceptionId, 'exception');
            });
          return res.status(400).json({ error: '存在未发放物资包，已拦截补贴发放', intercepted: true });
        } else {
          db.run(`INSERT INTO subsidy_records (volunteer_id, volunteer_name, rule_id, rule_name, amount, callback_id, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [volunteer_id, volunteer_name, rule_id, rule_name, amount, callback_id, '已发放', operator],
            function(err) {
              if (err) res.status(500).json({ error: err.message });
              else {
                const recordId = this.lastID;
                addAuditLog('subsidy_records', recordId, 'status', '待发放', '已发放', operator, '回调发放');
                addTimeline(volunteer_id, '补贴发放', `${rule_name} 补贴 ${amount}元 已发放`, operator, '已发放', recordId, 'subsidy_record');
                res.json({ id: recordId, success: true, message: '补贴发放成功' });
              }
            });
        }
      });
    });
  });

  app.put('/api/subsidy-records/:id/status', (req, res) => {
    const { status, operator, remarks } = req.body;
    db.get(`SELECT * FROM subsidy_records WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE subsidy_records SET status = ?, remarks = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [status, remarks, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('subsidy_records', req.params.id, 'status', oldRecord.status, status, operator, '状态变更');
              addTimeline(oldRecord.volunteer_id, '补贴状态变更', `${oldRecord.rule_name} 补贴状态变更为${status}`, operator, status, req.params.id, 'subsidy_record');
              res.json({ success: true, message: '状态更新成功' });
            }
          });
      }
    });
  });
};

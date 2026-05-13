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

  app.get('/api/volunteer-skills', (req, res) => {
    const { volunteer_id, status } = req.query;
    let sql = `SELECT * FROM volunteer_skills WHERE 1=1`;
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

  app.get('/api/volunteer-skills/:id', (req, res) => {
    db.get(`SELECT * FROM volunteer_skills WHERE id = ?`, [req.params.id], (err, row) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(row);
    });
  });

  app.post('/api/volunteer-skills', (req, res) => {
    const { volunteer_id, volunteer_name, skill_type, skill_level, operator } = req.body;
    db.run(`INSERT INTO volunteer_skills (volunteer_id, volunteer_name, skill_type, skill_level, created_by) VALUES (?, ?, ?, ?, ?)`,
      [volunteer_id, volunteer_name, skill_type, skill_level || '初级', operator],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const recordId = this.lastID;
          addTimeline(volunteer_id, '创建技能认证', `创建${skill_type}技能认证`, operator, '待审核', recordId, 'volunteer_skill');
          res.json({ id: recordId, message: '创建成功' });
        }
      });
  });

  app.put('/api/volunteer-skills/:id/status', (req, res) => {
    const { status, operator, remarks } = req.body;
    db.get(`SELECT * FROM volunteer_skills WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE volunteer_skills SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [status, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('volunteer_skills', req.params.id, 'status', oldRecord.status, status, operator, '状态变更');
              addTimeline(oldRecord.volunteer_id, '技能认证状态变更', `${oldRecord.skill_type}技能认证状态变更为${status}`, operator, status, req.params.id, 'volunteer_skill');
              res.json({ success: true, message: '状态更新成功' });
            }
          });
      }
    });
  });

  app.put('/api/volunteer-skills/:id', (req, res) => {
    const { skill_type, skill_level, operator } = req.body;
    db.get(`SELECT * FROM volunteer_skills WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`UPDATE volunteer_skills SET skill_type = ?, skill_level = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [skill_type, skill_level, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              if (oldRecord.skill_type !== skill_type) {
                addAuditLog('volunteer_skills', req.params.id, 'skill_type', oldRecord.skill_type, skill_type, operator, '修改');
              }
              if (oldRecord.skill_level !== skill_level) {
                addAuditLog('volunteer_skills', req.params.id, 'skill_level', oldRecord.skill_level, skill_level, operator, '修改');
              }
              addTimeline(oldRecord.volunteer_id, '更新技能信息', `更新${skill_type}技能信息`, operator, oldRecord.status, req.params.id, 'volunteer_skill');
              res.json({ success: true, message: '更新成功' });
            }
          });
      }
    });
  });

  app.get('/api/volunteer-skills/:id/audit-logs', (req, res) => {
    db.all(`SELECT * FROM audit_logs WHERE module = 'volunteer_skills' AND record_id = ? ORDER BY operate_time DESC`, [req.params.id], (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });
};

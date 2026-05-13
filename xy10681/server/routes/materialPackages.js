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

  app.get('/api/material-packages', (req, res) => {
    const { volunteer_id, distributed } = req.query;
    let sql = `SELECT * FROM material_packages WHERE 1=1`;
    let params = [];
    
    if (volunteer_id) {
      sql += ` AND volunteer_id = ?`;
      params.push(volunteer_id);
    }
    if (distributed !== undefined) {
      sql += ` AND distributed = ?`;
      params.push(distributed);
    }
    sql += ` ORDER BY created_at DESC`;
    
    db.all(sql, params, (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });

  app.post('/api/material-packages', (req, res) => {
    const { volunteer_id, volunteer_name, package_type, items, operator } = req.body;
    db.run(`INSERT INTO material_packages (volunteer_id, volunteer_name, package_type, items, created_by) VALUES (?, ?, ?, ?, ?)`,
      [volunteer_id, volunteer_name, package_type, JSON.stringify(items || []), operator],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          const recordId = this.lastID;
          addTimeline(volunteer_id, '创建物资包', `创建${package_type}物资包`, operator, '待发放', recordId, 'material_package');
          res.json({ id: recordId, message: '创建成功' });
        }
      });
  });

  app.post('/api/material-packages/:id/distribute', (req, res) => {
    const { operator } = req.body;
    db.get(`SELECT * FROM material_packages WHERE id = ?`, [req.params.id], (err, oldRecord) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        if (oldRecord.distributed) {
          return res.status(400).json({ error: '该物资包已发放' });
        }
        db.run(`UPDATE material_packages SET distributed = 1, distributed_at = ?, distributed_by = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          [moment().format('YYYY-MM-DD HH:mm:ss'), operator, operator, moment().format('YYYY-MM-DD HH:mm:ss'), req.params.id],
          function(err) {
            if (err) res.status(500).json({ error: err.message });
            else {
              addAuditLog('material_packages', req.params.id, 'distributed', '0', '1', operator, '发放');
              addTimeline(oldRecord.volunteer_id, '发放物资包', `发放${oldRecord.package_type}物资包`, operator, '已发放', req.params.id, 'material_package');
              res.json({ success: true, message: '物资包发放成功' });
            }
          });
      }
    });
  });

  app.get('/api/material-packages/check-intercept/:volunteer_id', (req, res) => {
    db.all(`SELECT * FROM material_packages WHERE volunteer_id = ? AND distributed = 0`, [req.params.volunteer_id], (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        const hasIntercept = rows.length > 0;
        res.json({
          has_intercept: hasIntercept,
          intercepted_packages: rows,
          message: hasIntercept ? '存在未发放物资包，需拦截补贴发放' : '无拦截项，可以发放补贴'
        });
      }
    });
  });
};

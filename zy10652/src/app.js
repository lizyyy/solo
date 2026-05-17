const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Parser } = require('json2csv');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new sqlite3.Database(dbPath);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, '/tmp'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.get('/api/applications', (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  
  let query = 'SELECT * FROM applications';
  let countQuery = 'SELECT COUNT(*) as total FROM applications';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    countQuery += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(countQuery, status ? [status] : [], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows, total: result.total, page: parseInt(page), limit: parseInt(limit) });
    });
  });
});

app.get('/api/applications/:appId', (req, res) => {
  const { appId } = req.params;
  
  db.get('SELECT * FROM applications WHERE app_id = ?', [appId], (err, app) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!app) return res.status(404).json({ error: '应用不存在' });
    
    db.all('SELECT * FROM permission_items WHERE app_id = ?', [appId], (err, permissions) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all('SELECT * FROM downgrade_records WHERE app_id = ? ORDER BY created_at DESC', [appId], (err, records) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ...app, permissions, downgrade_records: records });
      });
    });
  });
});

app.post('/api/applications', (req, res) => {
  const { app_id, app_name, owner, permissions } = req.body;
  
  if (!app_id || !app_name || !owner) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  db.run('INSERT INTO applications (app_id, app_name, owner, status) VALUES (?, ?, ?, ?)',
    [app_id, app_name, owner, 'normal'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (permissions && permissions.length > 0) {
        const stmt = db.prepare('INSERT INTO permission_items (app_id, permission_key, permission_name, original_level, target_level) VALUES (?, ?, ?, ?, ?)');
        permissions.forEach(p => {
          stmt.run(app_id, p.permission_key, p.permission_name, p.original_level || 1, p.target_level || 0);
        });
        stmt.finalize();
      }
      
      res.status(201).json({ app_id, app_name, owner, status: 'normal' });
    }
  );
});

app.post('/api/applications/:appId/downgrade', (req, res) => {
  const { appId } = req.params;
  const { audit_opinion, downgrade_reason, operator, old_token_high_permission = false } = req.body;
  
  if (!downgrade_reason || !operator) {
    return res.status(400).json({ error: '降级原因和操作人必填' });
  }
  
  db.get('SELECT * FROM applications WHERE app_id = ?', [appId], (err, app) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!app) return res.status(404).json({ error: '应用不存在' });
    
    let conflict_detected = false;
    let conflict_details = '';
    
    if (old_token_high_permission) {
      conflict_detected = true;
      conflict_details = '检测到旧token仍携带高权限，不能按普通更新处理，需要单独处理token刷新';
    }
    
    db.run('UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE app_id = ?',
      ['downgrade_pending', appId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run('INSERT INTO downgrade_records (app_id, status, audit_opinion, downgrade_reason, operator, old_token_high_permission, conflict_detected, conflict_details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [appId, 'downgrade_pending', audit_opinion || '', downgrade_reason, operator, old_token_high_permission ? 1 : 0, conflict_detected ? 1 : 0, conflict_details],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            db.run('INSERT INTO status_history (app_id, from_status, to_status, operator, remark) VALUES (?, ?, ?, ?, ?)',
              [appId, app.status, 'downgrade_pending', operator, '提交降级申请: ' + downgrade_reason],
              function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({ 
                  app_id: appId, 
                  status: 'downgrade_pending', 
                  conflict_detected,
                  conflict_details,
                  message: conflict_detected ? '检测到冲突，请处理token' : '降级申请已提交'
                });
              }
            );
          }
        );
      }
    );
  });
});

app.post('/api/applications/:appId/approve-downgrade', (req, res) => {
  const { appId } = req.params;
  const { operator, audit_opinion } = req.body;
  
  db.get('SELECT * FROM applications WHERE app_id = ?', [appId], (err, app) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!app) return res.status(404).json({ error: '应用不存在' });
    if (app.status !== 'downgrade_pending') {
      return res.status(400).json({ error: '当前状态不允许此操作' });
    }
    
    db.run('UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE app_id = ?',
      ['downgraded', appId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run('INSERT INTO downgrade_records (app_id, status, audit_opinion, operator) VALUES (?, ?, ?, ?)',
          [appId, 'downgraded', audit_opinion || '审核通过', operator || 'system'],
          function(err) {
            db.run('INSERT INTO status_history (app_id, from_status, to_status, operator, remark) VALUES (?, ?, ?, ?, ?)',
              [appId, 'downgrade_pending', 'downgraded', operator || 'system', '审核通过，执行降级'],
              function() {
                res.json({ app_id: appId, status: 'downgraded', message: '已完成降级' });
              }
            );
          }
        );
      }
    );
  });
});

app.post('/api/applications/:appId/request-restore', (req, res) => {
  const { appId } = req.params;
  const { operator, reason } = req.body;
  
  db.get('SELECT * FROM applications WHERE app_id = ?', [appId], (err, app) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!app) return res.status(404).json({ error: '应用不存在' });
    if (app.status !== 'downgraded') {
      return res.status(400).json({ error: '只有已降级状态可以申请恢复' });
    }
    
    db.run('UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE app_id = ?',
      ['restore_request', appId],
      function(err) {
        db.run('INSERT INTO downgrade_records (app_id, status, downgrade_reason, operator) VALUES (?, ?, ?, ?)',
          [appId, 'restore_request', reason || '申请恢复', operator || 'system'],
          function() {
            db.run('INSERT INTO status_history (app_id, from_status, to_status, operator, remark) VALUES (?, ?, ?, ?, ?)',
              [appId, 'downgraded', 'restore_request', operator || 'system', '提交恢复申请'],
              function() {
                res.json({ app_id: appId, status: 'restore_request', message: '恢复申请已提交' });
              }
            );
          }
        );
      }
    );
  });
});

app.post('/api/applications/:appId/restore', (req, res) => {
  const { appId } = req.params;
  const { operator, audit_opinion } = req.body;
  
  db.get('SELECT * FROM applications WHERE app_id = ?', [appId], (err, app) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!app) return res.status(404).json({ error: '应用不存在' });
    if (app.status !== 'restore_request') {
      return res.status(400).json({ error: '当前状态不允许此操作' });
    }
    
    db.run('UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE app_id = ?',
      ['normal', appId],
      function(err) {
        db.run('INSERT INTO status_history (app_id, from_status, to_status, operator, remark) VALUES (?, ?, ?, ?, ?)',
          [appId, 'restore_request', 'normal', operator || 'system', '审核通过，恢复正常'],
          function() {
            res.json({ app_id: appId, status: 'normal', message: '已恢复正常' });
          }
        );
      }
    );
  });
});

app.get('/api/applications/:appId/history', (req, res) => {
  const { appId } = req.params;
  db.all('SELECT * FROM status_history WHERE app_id = ? ORDER BY created_at DESC', [appId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.get('/api/export', (req, res) => {
  const { status } = req.query;
  
  let query = `
    SELECT a.app_id, a.app_name, a.owner, a.status, 
           r.downgrade_reason, r.audit_opinion, r.operator, r.conflict_detected,
           a.created_at, a.updated_at
    FROM applications a
    LEFT JOIN downgrade_records r ON a.app_id = r.app_id
  `;
  const params = [];
  
  if (status) {
    query += ' WHERE a.status = ?';
    params.push(status);
  }
  query += ' GROUP BY a.app_id ORDER BY a.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const json2csvParser = new Parser({
      fields: ['app_id', 'app_name', 'owner', 'status', 'downgrade_reason', 'audit_opinion', 'operator', 'conflict_detected', 'created_at', 'updated_at']
    });
    const csv = json2csvParser.parse(rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=permission_downgrade.csv');
    res.send('\uFEFF' + csv);
  });
});

app.post('/api/import', upload.single('file'), (req, res) => {
  const csv = require('csv-parser');
  const results = [];
  const errors = [];
  let rowNum = 0;
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      rowNum++;
      if (!data.app_id || !data.app_name || !data.owner) {
        errors.push({ row: rowNum, data, error: '缺少必填字段' });
      } else {
        results.push(data);
      }
    })
    .on('end', () => {
      const success = [];
      const stmt = db.prepare('INSERT OR REPLACE INTO applications (app_id, app_name, owner, status) VALUES (?, ?, ?, ?)');
      
      results.forEach((row, idx) => {
        stmt.run(row.app_id, row.app_name, row.owner, row.status || 'normal', function(err) {
          if (err) {
            errors.push({ row: idx + 1, data: row, error: err.message });
          } else {
            success.push(row.app_id);
          }
        });
      });
      stmt.finalize(() => {
        fs.unlinkSync(req.file.path);
        res.json({ 
          success: success.length, 
          failed: errors.length, 
          success_ids: success,
          errors 
        });
      });
    });
});

app.get('/api/status-stats', (req, res) => {
  db.all(`
    SELECT status, COUNT(*) as count 
    FROM applications 
    GROUP BY status
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
});

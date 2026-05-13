const express = require('express');
const cors = require('cors');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  db.serialize(() => {
    db.get('SELECT COUNT(*) as total FROM hit_records', [], (err, totalRow) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get('SELECT COUNT(*) as adopted FROM hit_records WHERE adopted = 1', [], (err, adoptedRow) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get('SELECT COUNT(*) as pending FROM feedbacks WHERE status = ?', ['pending'], (err, pendingRow) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.all(`
            SELECT u.id, u.name, COUNT(f.id) as count 
            FROM feedbacks f 
            JOIN hit_records hr ON f.hit_record_id = hr.id 
            JOIN users u ON hr.agent_id = u.id 
            WHERE f.status = 'pending' 
            GROUP BY u.id, u.name
          `, [], (err, owners) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const hitRate = totalRow.total > 0 ? (adoptedRow.adopted / totalRow.total * 100).toFixed(2) : 0;
            
            res.json({
              hitRate: parseFloat(hitRate),
              totalHits: totalRow.total,
              pendingRevisions: pendingRow.pending,
              responsiblePersons: owners
            });
          });
        });
      });
    });
  });
});

app.get('/api/intents', (req, res) => {
  const { search, category, status } = req.query;
  let query = 'SELECT * FROM intents WHERE 1=1';
  const params = [];
  
  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/intents/:id', (req, res) => {
  db.get('SELECT * FROM intents WHERE id = ?', [req.params.id], (err, intent) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!intent) return res.status(404).json({ error: '意图不存在' });
    
    db.all('SELECT * FROM reply_versions WHERE intent_id = ? ORDER BY version DESC', [req.params.id], (err, versions) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all('SELECT * FROM hit_records WHERE intent_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.id], (err, hits) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all('SELECT * FROM feedbacks f JOIN hit_records hr ON f.hit_record_id = hr.id WHERE hr.intent_id = ? ORDER BY f.created_at DESC', [req.params.id], (err, feedbacks) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.all('SELECT * FROM revisions WHERE intent_id = ? ORDER BY created_at DESC', [req.params.id], (err, revisions) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
              intent,
              versions,
              hits,
              feedbacks,
              revisions
            });
          });
        });
      });
    });
  });
});

app.get('/api/timeline/:intentId', (req, res) => {
  const { intentId } = req.params;
  const timeline = [];
  
  db.all('SELECT *, "version" as type FROM reply_versions WHERE intent_id = ?', [intentId], (err, versions) => {
    if (err) return res.status(500).json({ error: err.message });
    timeline.push(...versions.map(v => ({ ...v, eventType: 'version' })));
    
    db.all('SELECT *, "hit" as type FROM hit_records WHERE intent_id = ?', [intentId], (err, hits) => {
      if (err) return res.status(500).json({ error: err.message });
      timeline.push(...hits.map(h => ({ ...h, eventType: 'hit' })));
      
      db.all('SELECT f.*, "feedback" as type FROM feedbacks f JOIN hit_records hr ON f.hit_record_id = hr.id WHERE hr.intent_id = ?', [intentId], (err, feedbacks) => {
        if (err) return res.status(500).json({ error: err.message });
        timeline.push(...feedbacks.map(f => ({ ...f, eventType: 'feedback' })));
        
        db.all('SELECT *, "revision" as type FROM revisions WHERE intent_id = ?', [intentId], (err, revisions) => {
          if (err) return res.status(500).json({ error: err.message });
          timeline.push(...revisions.map(r => ({ ...r, eventType: 'revision' })));
          
          timeline.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          res.json(timeline);
        });
      });
    });
  });
});

app.post('/api/feedbacks', (req, res) => {
  const { hit_record_id, type, reason, reported_by } = req.body;
  
  if (!hit_record_id || !type || !reported_by) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  const id = uuidv4();
  db.run(
    'INSERT INTO feedbacks (id, hit_record_id, type, reason, reported_by) VALUES (?, ?, ?, ?, ?)',
    [id, hit_record_id, type, reason, reported_by],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, message: '反馈提交成功' });
    }
  );
});

app.put('/api/feedbacks/:id/upgrade', (req, res) => {
  db.run(
    'UPDATE feedbacks SET priority = "high", status = "pending" WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '反馈已升级' });
    }
  );
});

app.post('/api/merge-feedbacks', (req, res) => {
  const { targetId, sourceIds } = req.body;
  
  if (!targetId || !sourceIds || sourceIds.length === 0) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  db.serialize(() => {
    const stmt = db.prepare('UPDATE feedbacks SET merged_from = ?, status = "merged" WHERE id = ?');
    sourceIds.forEach(id => stmt.run(targetId, id));
    stmt.finalize();
    
    db.run('UPDATE feedbacks SET priority = "high" WHERE id = ?', [targetId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '反馈合并成功' });
    });
  });
});

app.post('/api/revisions', (req, res) => {
  const { intent_id, reply_version_id, action, previous_content, new_content, revised_by, remark } = req.body;
  
  if (!intent_id || !action || !revised_by) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  const id = uuidv4();
  db.run(
    'INSERT INTO revisions (id, intent_id, reply_version_id, action, previous_content, new_content, revised_by, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, intent_id, reply_version_id, action, previous_content, new_content, revised_by, remark],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, message: '修订记录创建成功' });
    }
  );
});

app.post('/api/reply-versions', (req, res) => {
  const { intent_id, content, created_by } = req.body;
  
  if (!intent_id || !content || !created_by) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  db.serialize(() => {
    db.get('SELECT MAX(version) as max_version FROM reply_versions WHERE intent_id = ?', [intent_id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const newVersion = (row.max_version || 0) + 1;
      const id = uuidv4();
      
      db.run('UPDATE reply_versions SET is_current = 0 WHERE intent_id = ?', [intent_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(
          'INSERT INTO reply_versions (id, intent_id, content, version, created_by, is_current) VALUES (?, ?, ?, ?, ?, 1)',
          [id, intent_id, content, newVersion, created_by],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, version: newVersion, message: '新版本创建成功' });
          }
        );
      });
    });
  });
});

app.post('/api/rollback-version', (req, res) => {
  const { intent_id, version_id, revised_by } = req.body;
  
  if (!intent_id || !version_id || !revised_by) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  db.serialize(() => {
    db.run('UPDATE reply_versions SET is_current = 0 WHERE intent_id = ?', [intent_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.run('UPDATE reply_versions SET is_current = 1 WHERE id = ?', [version_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const revId = uuidv4();
        db.run(
          'INSERT INTO revisions (id, intent_id, reply_version_id, action, revised_by, remark) VALUES (?, ?, ?, "rollback", ?, "版本回滚")',
          [revId, intent_id, version_id, revised_by],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: '版本回滚成功' });
          }
        );
      });
    });
  });
});

app.get('/api/export', (req, res) => {
  const { type } = req.query;
  
  let query, filename;
  
  switch (type) {
    case 'feedbacks':
      query = `
        SELECT f.*, i.name as intent_name, hr.user_query, u.name as agent_name
        FROM feedbacks f
        JOIN hit_records hr ON f.hit_record_id = hr.id
        JOIN intents i ON hr.intent_id = i.id
        JOIN users u ON hr.agent_id = u.id
      `;
      filename = 'feedbacks.csv';
      break;
    case 'hits':
      query = `
        SELECT hr.*, i.name as intent_name, rv.version, u.name as agent_name
        FROM hit_records hr
        JOIN intents i ON hr.intent_id = i.id
        JOIN reply_versions rv ON hr.reply_version_id = rv.id
        JOIN users u ON hr.agent_id = u.id
      `;
      filename = 'hit_records.csv';
      break;
    default:
      return res.status(400).json({ error: '无效的导出类型' });
  }
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const parser = new Parser();
    const csv = parser.parse(rows);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
  });
});

app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
});

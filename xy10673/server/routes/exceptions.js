const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

router.get('/', (req, res) => {
  const { status, type, priority, assigned_to } = req.query;
  let query = `SELECT * FROM exceptions WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  if (assigned_to) {
    query += ' AND assigned_to = ?';
    params.push(assigned_to);
  }
  
  query += ' ORDER BY priority DESC, created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/stats', (req, res) => {
  db.all(`
    SELECT 
      status, 
      COUNT(*) as count,
      priority
    FROM exceptions
    GROUP BY status, priority
    ORDER BY status, priority DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stats = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      high_priority: 0
    };
    
    rows.forEach(row => {
      if (row.status === 'open') stats.open += row.count;
      if (row.status === 'in_progress') stats.in_progress += row.count;
      if (row.status === 'resolved') stats.resolved += row.count;
      if (row.priority === 'high') stats.high_priority += row.count;
    });
    
    res.json(stats);
  });
});

router.put('/:id', (req, res) => {
  const { status, handled_by, resolution } = req.body;
  const handled_at = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run(
    `UPDATE exceptions SET status = ?, handled_by = ?, handled_at = ?, resolution = ? WHERE id = ?`,
    [status, handled_by, handled_at, resolution, req.params.id],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '异常已更新' });
    }
  );
});

router.post('/:id/assign', (req, res) => {
  const { assigned_to } = req.body;
  
  db.run(
    `UPDATE exceptions SET assigned_to = ?, status = 'in_progress' WHERE id = ?`,
    [assigned_to, req.params.id],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '异常已分配' });
    }
  );
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM announcements WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { title, content, type, affected_routes, affected_stations, effective_date, created_by } = req.body;
  const sql = `INSERT INTO announcements (title, content, type, affected_routes, affected_stations, effective_date, created_by) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [title, content, type, affected_routes, affected_stations, effective_date, created_by], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, ...req.body, status: 'draft' });
  });
});

router.post('/:id/publish', (req, res) => {
  const sql = 'UPDATE announcements SET status = ?, published_at = CURRENT_TIMESTAMP WHERE id = ?';
  db.run(sql, ['published', req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: req.params.id, status: 'published', message: '公告已发布' });
  });
});

router.put('/:id', (req, res) => {
  const { title, content, type, affected_routes, affected_stations, effective_date } = req.body;
  const sql = `UPDATE announcements SET title=?, content=?, type=?, affected_routes=?, affected_stations=?, effective_date=? 
               WHERE id=?`;
  
  db.run(sql, [title, content, type, affected_routes, affected_stations, effective_date, req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: req.params.id, message: '公告已更新' });
  });
});

module.exports = router;

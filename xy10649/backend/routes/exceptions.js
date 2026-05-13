const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { exception_type, related_module, status } = req.query;
  let sql = 'SELECT * FROM exception_records WHERE 1=1';
  const params = [];

  if (exception_type) {
    sql += ' AND exception_type = ?';
    params.push(exception_type);
  }
  if (related_module) {
    sql += ' AND related_module = ?';
    params.push(related_module);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM exception_records WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: row });
  });
});

router.post('/', (req, res) => {
  const { exception_type, related_module, related_id, reason, before_value, after_value, handler, handle_time, status, remarks } = req.body;
  const sql = `INSERT INTO exception_records 
    (exception_type, related_module, related_id, reason, before_value, after_value, handler, handle_time, status, remarks) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [exception_type, related_module, related_id, reason, before_value, after_value, handler, handle_time, status || 'pending', remarks], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  const { exception_type, related_module, related_id, reason, before_value, after_value, handler, handle_time, status, remarks } = req.body;
  const sql = `UPDATE exception_records SET 
    exception_type = ?, related_module = ?, related_id = ?, reason = ?, before_value = ?, after_value = ?, handler = ?, handle_time = ?, status = ?, remarks = ?
    WHERE id = ?`;
  
  db.run(sql, [exception_type, related_module, related_id, reason, before_value, after_value, handler, handle_time, status, remarks, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '更新成功' });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM exception_records WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { gift_type, handler, source_type } = req.query;
  let sql = 'SELECT * FROM return_inventory WHERE 1=1';
  const params = [];

  if (gift_type) {
    sql += ' AND gift_type = ?';
    params.push(gift_type);
  }
  if (handler) {
    sql += ' AND handler LIKE ?';
    params.push(`%${handler}%`);
  }
  if (source_type) {
    sql += ' AND source_type = ?';
    params.push(source_type);
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
  db.get('SELECT * FROM return_inventory WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: row });
  });
});

router.post('/', (req, res) => {
  const { gift_type, quantity, return_reason, return_date, handler, source_type, source_id, remarks } = req.body;
  const sql = `INSERT INTO return_inventory 
    (gift_type, quantity, return_reason, return_date, handler, source_type, source_id, remarks) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [gift_type, quantity, return_reason, return_date, handler, source_type, source_id, remarks], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  const { gift_type, quantity, return_reason, return_date, handler, source_type, source_id, remarks } = req.body;
  const sql = `UPDATE return_inventory SET 
    gift_type = ?, quantity = ?, return_reason = ?, return_date = ?, handler = ?, source_type = ?, source_id = ?, remarks = ?
    WHERE id = ?`;
  
  db.run(sql, [gift_type, quantity, return_reason, return_date, handler, source_type, source_id, remarks, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '更新成功' });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM return_inventory WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;

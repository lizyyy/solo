const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { tracking_number, customer_id, status } = req.query;
  let sql = 'SELECT * FROM express_orders WHERE 1=1';
  const params = [];

  if (tracking_number) {
    sql += ' AND tracking_number LIKE ?';
    params.push(`%${tracking_number}%`);
  }
  if (customer_id) {
    sql += ' AND customer_id = ?';
    params.push(customer_id);
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
  db.get('SELECT * FROM express_orders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: row });
  });
});

router.post('/', (req, res) => {
  const { customer_id, tracking_number, express_company, sender, send_date, receive_date, status, remarks } = req.body;
  const sql = `INSERT INTO express_orders 
    (customer_id, tracking_number, express_company, sender, send_date, receive_date, status, remarks) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [customer_id, tracking_number, express_company, sender, send_date, receive_date, status || 'pending', remarks], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  const { customer_id, tracking_number, express_company, sender, send_date, receive_date, status, remarks } = req.body;
  const sql = `UPDATE express_orders SET 
    customer_id = ?, tracking_number = ?, express_company = ?, sender = ?, send_date = ?, receive_date = ?, status = ?, remarks = ?
    WHERE id = ?`;
  
  db.run(sql, [customer_id, tracking_number, express_company, sender, send_date, receive_date, status, remarks, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '更新成功' });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM express_orders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;

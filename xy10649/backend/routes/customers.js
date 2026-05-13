const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { customer_name, plan_id, status } = req.query;
  let sql = 'SELECT * FROM customer_lists WHERE 1=1';
  const params = [];

  if (customer_name) {
    sql += ' AND customer_name LIKE ?';
    params.push(`%${customer_name}%`);
  }
  if (plan_id) {
    sql += ' AND plan_id = ?';
    params.push(plan_id);
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
  db.get('SELECT * FROM customer_lists WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: row });
  });
});

router.get('/:id/history', (req, res) => {
  db.all(
    'SELECT * FROM customer_lists_history WHERE customer_id = ? ORDER BY created_at DESC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ data: rows });
    }
  );
});

router.post('/', (req, res) => {
  const { plan_id, customer_name, phone, address, gift_type, gift_quantity, status, remarks } = req.body;
  const sql = `INSERT INTO customer_lists 
    (plan_id, customer_name, phone, address, gift_type, gift_quantity, status, remarks) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [plan_id, customer_name, phone, address, gift_type, gift_quantity, status || 'pending', remarks], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const afterData = JSON.stringify(req.body);
    db.run(
      'INSERT INTO customer_lists_history (customer_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
      [this.lastID, null, afterData, 'system', 'create']
    );
    
    res.json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  db.get('SELECT * FROM customer_lists WHERE id = ?', [req.params.id], (err, before) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const { plan_id, customer_name, phone, address, gift_type, gift_quantity, status, remarks } = req.body;
    const sql = `UPDATE customer_lists SET 
      plan_id = ?, customer_name = ?, phone = ?, address = ?, gift_type = ?, gift_quantity = ?, status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`;
    
    db.run(sql, [plan_id, customer_name, phone, address, gift_type, gift_quantity, status, remarks, req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const beforeData = JSON.stringify(before);
      const afterData = JSON.stringify(req.body);
      db.run(
        'INSERT INTO customer_lists_history (customer_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, beforeData, afterData, 'system', 'update']
      );
      
      res.json({ message: '更新成功' });
    });
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT * FROM customer_lists WHERE id = ?', [req.params.id], (err, before) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.run('DELETE FROM customer_lists WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const beforeData = JSON.stringify(before);
      db.run(
        'INSERT INTO customer_lists_history (customer_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, beforeData, null, 'system', 'delete']
      );
      
      res.json({ message: '删除成功' });
    });
  });
});

module.exports = router;

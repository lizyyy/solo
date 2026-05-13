const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, keyword, status, responsible_person } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM package_orders WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM package_orders WHERE 1=1';
  const params = [];
  
  if (keyword) {
    query += ' AND (order_no LIKE ? OR plate_number LIKE ? OR customer_name LIKE ?)';
    countQuery += ' AND (order_no LIKE ? OR plate_number LIKE ? OR customer_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
  }
  
  if (responsible_person) {
    query += ' AND responsible_person = ?';
    countQuery += ' AND responsible_person = ?';
    params.push(responsible_person);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  
  db.get(countQuery, params.slice(0, params.length - (keyword ? 3 : 0) - (status ? 1 : 0) - (responsible_person ? 1 : 0)), (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.all(query, [...params, parseInt(pageSize), offset], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: rows, total: countResult.total });
    });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM package_orders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.get('/:id/logs', (req, res) => {
  db.all('SELECT * FROM package_orders_log WHERE order_id = ? ORDER BY modified_at DESC', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { order_no, plate_number, customer_name, package_name, total_amount, purchase_date, expire_date, remaining_times, used_times, responsible_person } = req.body;
  
  db.run(
    'INSERT INTO package_orders (order_no, plate_number, customer_name, package_name, total_amount, purchase_date, expire_date, remaining_times, used_times, responsible_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [order_no, plate_number, customer_name, package_name, total_amount, purchase_date, expire_date, remaining_times, used_times, responsible_person],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.put('/:id', (req, res) => {
  const { order_no, plate_number, customer_name, package_name, total_amount, purchase_date, expire_date, remaining_times, used_times, responsible_person, status, modified_by } = req.body;
  const orderId = req.params.id;
  
  db.get('SELECT * FROM package_orders WHERE id = ?', [orderId], (err, oldOrder) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.run(
      'UPDATE package_orders SET order_no = ?, plate_number = ?, customer_name = ?, package_name = ?, total_amount = ?, purchase_date = ?, expire_date = ?, remaining_times = ?, used_times = ?, responsible_person = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [order_no, plate_number, customer_name, package_name, total_amount, purchase_date, expire_date, remaining_times, used_times, responsible_person, status || 'active', orderId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.run(
          'INSERT INTO package_orders_log (order_id, old_value, new_value, modified_by) VALUES (?, ?, ?, ?)',
          [orderId, JSON.stringify(oldOrder), JSON.stringify(req.body), modified_by || 'system'],
          (logErr) => {
            if (logErr) {
              console.error('记录日志失败:', logErr);
            }
            res.json({ updated: this.changes });
          }
        );
      }
    );
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM package_orders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ deleted: this.changes });
  });
});

module.exports = router;

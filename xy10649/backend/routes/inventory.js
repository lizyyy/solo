const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { gift_name, gift_type } = req.query;
  let sql = 'SELECT * FROM gift_inventory WHERE 1=1';
  const params = [];

  if (gift_name) {
    sql += ' AND gift_name LIKE ?';
    params.push(`%${gift_name}%`);
  }
  if (gift_type) {
    sql += ' AND gift_type = ?';
    params.push(gift_type);
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
  db.get('SELECT * FROM gift_inventory WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: row });
  });
});

router.get('/:id/history', (req, res) => {
  db.all(
    'SELECT * FROM gift_inventory_history WHERE inventory_id = ? ORDER BY created_at DESC',
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
  const { gift_name, gift_type, quantity, unit, unit_price, supplier, remarks } = req.body;
  const sql = `INSERT INTO gift_inventory 
    (gift_name, gift_type, quantity, unit, unit_price, supplier, remarks) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [gift_name, gift_type, quantity, unit, unit_price, supplier, remarks], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const afterData = JSON.stringify(req.body);
    db.run(
      'INSERT INTO gift_inventory_history (inventory_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
      [this.lastID, null, afterData, 'system', 'create']
    );
    
    res.json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  db.get('SELECT * FROM gift_inventory WHERE id = ?', [req.params.id], (err, before) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const { gift_name, gift_type, quantity, unit, unit_price, supplier, remarks } = req.body;
    const sql = `UPDATE gift_inventory SET 
      gift_name = ?, gift_type = ?, quantity = ?, unit = ?, unit_price = ?, supplier = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`;
    
    db.run(sql, [gift_name, gift_type, quantity, unit, unit_price, supplier, remarks, req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const beforeData = JSON.stringify(before);
      const afterData = JSON.stringify(req.body);
      db.run(
        'INSERT INTO gift_inventory_history (inventory_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, beforeData, afterData, 'system', 'update']
      );
      
      res.json({ message: '更新成功' });
    });
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT * FROM gift_inventory WHERE id = ?', [req.params.id], (err, before) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.run('DELETE FROM gift_inventory WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const beforeData = JSON.stringify(before);
      db.run(
        'INSERT INTO gift_inventory_history (inventory_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, beforeData, null, 'system', 'delete']
      );
      
      res.json({ message: '删除成功' });
    });
  });
});

module.exports = router;

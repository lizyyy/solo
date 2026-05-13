const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, keyword, responsible_person } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM maintenance_items WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM maintenance_items WHERE 1=1';
  const params = [];
  
  if (keyword) {
    query += ' AND (item_code LIKE ? OR item_name LIKE ?)';
    countQuery += ' AND (item_code LIKE ? OR item_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (responsible_person) {
    query += ' AND responsible_person = ?';
    countQuery += ' AND responsible_person = ?';
    params.push(responsible_person);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  
  db.get(countQuery, params.slice(0, params.length - (keyword ? 2 : 0) - (responsible_person ? 1 : 0)), (err, countResult) => {
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
  db.get('SELECT * FROM maintenance_items WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.get('/:id/logs', (req, res) => {
  db.all('SELECT * FROM maintenance_items_log WHERE item_id = ? ORDER BY modified_at DESC', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { item_code, item_name, description, standard_mileage, standard_days, price, responsible_person } = req.body;
  
  db.run(
    'INSERT INTO maintenance_items (item_code, item_name, description, standard_mileage, standard_days, price, responsible_person) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [item_code, item_name, description, standard_mileage, standard_days, price, responsible_person],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.put('/:id', (req, res) => {
  const { item_code, item_name, description, standard_mileage, standard_days, price, responsible_person, modified_by } = req.body;
  const itemId = req.params.id;
  
  db.get('SELECT * FROM maintenance_items WHERE id = ?', [itemId], (err, oldItem) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.run(
      'UPDATE maintenance_items SET item_code = ?, item_name = ?, description = ?, standard_mileage = ?, standard_days = ?, price = ?, responsible_person = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [item_code, item_name, description, standard_mileage, standard_days, price, responsible_person, itemId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.run(
          'INSERT INTO maintenance_items_log (item_id, old_value, new_value, modified_by) VALUES (?, ?, ?, ?)',
          [itemId, JSON.stringify(oldItem), JSON.stringify(req.body), modified_by || 'system'],
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
  db.run('DELETE FROM maintenance_items WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ deleted: this.changes });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const query = `
    SELECT c.*, COUNT(a.id) as artwork_count
    FROM customers c
    LEFT JOIN artworks a ON c.id = a.customer_id
    GROUP BY c.id
    ORDER BY c.name
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT c.*, COUNT(a.id) as artwork_count
    FROM customers c
    LEFT JOIN artworks a ON c.id = a.customer_id
    WHERE c.id = ?
    GROUP BY c.id
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '客户不存在' });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, phone, email, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '客户名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO customers (name, phone, email, notes)
    VALUES (?, ?, ?, ?)
  `;
  
  db.run(query, [name, phone, email, notes], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      id: this.lastID,
      name,
      phone,
      email,
      notes,
      created_at: new Date().toISOString()
    });
  });
});

router.put('/:id', (req, res) => {
  const { name, phone, email, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '客户名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE customers 
    SET name = ?, phone = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [name, phone, email, notes, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '客户不存在' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      name,
      phone,
      email,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.delete('/:id', (req, res) => {
  const checkQuery = 'SELECT COUNT(*) as count FROM artworks WHERE customer_id = ?';
  
  db.get(checkQuery, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: `该客户下有 ${row.count} 个作品，无法删除` });
      return;
    }
    
    const deleteQuery = 'DELETE FROM customers WHERE id = ?';
    
    db.run(deleteQuery, [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '客户不存在' });
        return;
      }
      res.json({ message: '删除成功', id: parseInt(req.params.id) });
    });
  });
});

router.get('/:id/artworks', (req, res) => {
  const query = `
    SELECT a.*, 
      c.name as clay_name,
      g1.name as glaze_name,
      g2.name as glaze2_name
    FROM artworks a
    LEFT JOIN clays c ON a.clay_id = c.id
    LEFT JOIN glazes g1 ON a.glaze_id = g1.id
    LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
    WHERE a.customer_id = ?
    ORDER BY a.created_at DESC
  `;
  
  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;

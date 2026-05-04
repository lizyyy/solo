const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 获取所有库存
router.get('/', (req, res) => {
  const query = `
    SELECT i.*, m.name as medicine_name, m.specification
    FROM inventory i
    LEFT JOIN medicines m ON i.medicine_id = m.id
    ORDER BY i.last_updated DESC
  `;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取低库存预警
router.get('/low-stock', (req, res) => {
  const query = `
    SELECT i.*, m.name as medicine_name, m.specification
    FROM inventory i
    LEFT JOIN medicines m ON i.medicine_id = m.id
    WHERE i.quantity <= i.threshold
    ORDER BY i.quantity ASC
  `;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取单个库存
router.get('/:id', (req, res) => {
  const query = `
    SELECT i.*, m.name as medicine_name, m.specification
    FROM inventory i
    LEFT JOIN medicines m ON i.medicine_id = m.id
    WHERE i.id = ?
  `;
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '库存不存在' });
      return;
    }
    res.json(row);
  });
});

// 创建库存
router.post('/', (req, res) => {
  const { medicine_id, quantity, threshold, unit, notes } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO inventory (id, medicine_id, quantity, threshold, unit, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, medicine_id, quantity || 0, threshold || 10, unit || '盒', notes],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id, 
        medicine_id, 
        quantity: quantity || 0, 
        threshold: threshold || 10, 
        unit: unit || '盒', 
        notes 
      });
    }
  );
});

// 更新库存
router.put('/:id', (req, res) => {
  const { quantity, threshold, unit, notes } = req.body;
  
  db.run(
    `UPDATE inventory 
     SET quantity = ?, threshold = ?, unit = ?, notes = ?, last_updated = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [quantity, threshold, unit, notes, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '库存不存在' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        quantity, 
        threshold, 
        unit, 
        notes 
      });
    }
  );
});

// 增加库存
router.post('/:id/add', (req, res) => {
  const { quantity, notes } = req.body;
  
  db.get('SELECT * FROM inventory WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '库存不存在' });
      return;
    }
    
    const newQuantity = row.quantity + quantity;
    
    db.run(
      `UPDATE inventory 
       SET quantity = ?, last_updated = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newQuantity, req.params.id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ 
          id: req.params.id, 
          old_quantity: row.quantity,
          added_quantity: quantity,
          new_quantity: newQuantity
        });
      }
    );
  });
});

// 减少库存
router.post('/:id/remove', (req, res) => {
  const { quantity, notes } = req.body;
  
  db.get('SELECT * FROM inventory WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '库存不存在' });
      return;
    }
    
    if (row.quantity < quantity) {
      res.status(400).json({ error: '库存不足' });
      return;
    }
    
    const newQuantity = row.quantity - quantity;
    
    db.run(
      `UPDATE inventory 
       SET quantity = ?, last_updated = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newQuantity, req.params.id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ 
          id: req.params.id, 
          old_quantity: row.quantity,
          removed_quantity: quantity,
          new_quantity: newQuantity
        });
      }
    );
  });
});

module.exports = router;

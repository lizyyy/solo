const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM spare_parts ORDER BY updatedAt DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, code, quantity, unit, location, threshold } = req.body;
  const id = uuidv4();
  const now = Date.now();

  db.run(
    'INSERT INTO spare_parts (id, name, code, quantity, unit, location, threshold, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, code, quantity, unit, location, threshold || 5, now],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

router.put('/:id/use', (req, res) => {
  const db = getDb();
  const { quantity, orderId, operator } = req.body;
  
  db.get('SELECT * FROM spare_parts WHERE id = ?', [req.params.id], (err, part) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!part) return res.status(404).json({ error: '备件不存在' });
    
    if (part.quantity < quantity) {
      return res.status(400).json({ error: '库存不足', currentQuantity: part.quantity });
    }

    const newQuantity = part.quantity - quantity;
    const now = Date.now();

    db.run(
      'UPDATE spare_parts SET quantity = ?, updatedAt = ? WHERE id = ?',
      [newQuantity, now, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (newQuantity <= part.threshold) {
          res.json({ success: true, warning: '库存低于警戒线', currentQuantity: newQuantity });
        } else {
          res.json({ success: true, currentQuantity: newQuantity });
        }
      }
    );
  });
});

module.exports = router;

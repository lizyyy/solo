const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  db.all('SELECT * FROM products WHERE is_available = 1 ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/all', (req, res) => {
  db.all('SELECT * FROM products ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '商品不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, price, unit, category, stock_quantity, description } = req.body;
  
  if (!name || price === undefined || !unit) {
    return res.status(400).json({ error: '商品名称、价格和单位为必填项' });
  }

  const id = uuidv4();
  const is_available = 1;
  
  db.run(
    'INSERT INTO products (id, name, price, unit, category, stock_quantity, is_available, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, price, unit, category || '', stock_quantity || 0, is_available, description || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, name, price, unit, category, stock_quantity, is_available, description });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name, price, unit, category, stock_quantity, is_available, description } = req.body;
  const productId = req.params.id;

  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const updatedName = name !== undefined ? name : row.name;
    const updatedPrice = price !== undefined ? price : row.price;
    const updatedUnit = unit !== undefined ? unit : row.unit;
    const updatedCategory = category !== undefined ? category : row.category;
    const updatedStock = stock_quantity !== undefined ? stock_quantity : row.stock_quantity;
    const updatedAvailable = is_available !== undefined ? is_available : row.is_available;
    const updatedDescription = description !== undefined ? description : row.description;

    db.run(
      'UPDATE products SET name = ?, price = ?, unit = ?, category = ?, stock_quantity = ?, is_available = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [updatedName, updatedPrice, updatedUnit, updatedCategory, updatedStock, updatedAvailable, updatedDescription, productId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: productId,
          name: updatedName,
          price: updatedPrice,
          unit: updatedUnit,
          category: updatedCategory,
          stock_quantity: updatedStock,
          is_available: updatedAvailable,
          description: updatedDescription
        });
      }
    );
  });
});

router.delete('/:id', (req, res) => {
  const productId = req.params.id;

  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '商品不存在' });
    }

    db.run('DELETE FROM products WHERE id = ?', [productId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: '商品已删除', id: productId });
    });
  });
});

module.exports = router;

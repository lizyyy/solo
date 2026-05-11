const express = require('express');
const db = require('../db');
const router = express.Router();

router.post('/', (req, res) => {
  const { stream_id, name, price, stock } = req.body;
  
  if (!stream_id || !name || price === undefined) {
    return res.status(400).json({ error: '直播场次ID、商品名称和价格必填' });
  }

  const stream = db.prepare('SELECT * FROM streams WHERE id = ?').get(stream_id);
  if (!stream) return res.status(404).json({ error: '直播场次不存在' });

  const stmt = db.prepare(`
    INSERT INTO products (stream_id, name, price, stock)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(stream_id, name, price, stock || 0);
  
  res.json({ id: result.lastInsertRowid, message: '商品创建成功' });
});

router.get('/', (req, res) => {
  const { stream_id } = req.query;
  let products;
  
  if (stream_id) {
    products = db.prepare('SELECT * FROM products WHERE stream_id = ?').all(stream_id);
  } else {
    products = db.prepare('SELECT * FROM products').all();
  }
  
  res.json(products);
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: '商品不存在' });
  res.json(product);
});

router.put('/:id', (req, res) => {
  const { name, price, stock } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: '商品不存在' });

  const stmt = db.prepare(`
    UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?
  `);
  stmt.run(name || product.name, price || product.price, stock !== undefined ? stock : product.stock, req.params.id);
  
  res.json({ message: '商品更新成功' });
});

module.exports = router;

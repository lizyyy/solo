const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

router.get('/', (req, res) => {
  const { category, status, keyword } = req.query;
  
  let whereClause = '1=1';
  const params = [];

  if (category) {
    whereClause += ' AND p.category = ?';
    params.push(category);
  }

  if (status) {
    whereClause += ' AND p.status = ?';
    params.push(status);
  }

  if (keyword) {
    whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const products = db.all(`
    SELECT p.*
    FROM products p
    WHERE ${whereClause}
    ORDER BY p.category, p.name
  `, params);

  res.json(products);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const product = db.get('SELECT * FROM products WHERE id = ?', [id]);

  if (!product) {
    return res.status(404).json({ error: '商品不存在' });
  }

  const adjustments = db.all(`
    SELECT pa.*, pai.original_price, pai.new_price
    FROM price_adjustments pa
    JOIN price_adjustment_items pai ON pa.id = pai.adjustment_id
    WHERE pai.product_id = ?
    ORDER BY pa.effect_time DESC
    LIMIT 10
  `, [id]);

  res.json({ ...product, adjustments });
});

router.post('/', (req, res) => {
  const { sku, name, category, unit, currentPrice } = req.body;

  if (!sku || !name || !currentPrice) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const existing = db.get('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing) {
      throw new Error('商品SKU已存在');
    }

    const id = uuidv4();
    
    db.run(`
      INSERT INTO products (id, sku, name, category, unit, current_price, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [id, sku, name, category || null, unit || null, currentPrice]);

    res.json({ id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { sku, name, category, unit, currentPrice, status } = req.body;

  try {
    const product = db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      throw new Error('商品不存在');
    }

    if (sku && sku !== product.sku) {
      const existing = db.get('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, id]);
      if (existing) {
        throw new Error('商品SKU已存在');
      }
    }

    db.run(`
      UPDATE products 
      SET sku = ?, name = ?, category = ?, unit = ?, current_price = ?, status = ?
      WHERE id = ?
    `, [sku || product.sku, name || product.name, category || null, unit || null, currentPrice !== undefined ? currentPrice : product.current_price, status || product.status, id]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
